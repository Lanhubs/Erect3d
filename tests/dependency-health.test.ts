import { expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const members = ['api', 'client', 'motion-video'] as const

async function manifest(directory: string) {
  return (await Bun.file(`${root}/${directory}/package.json`).json()) as {
    name?: string
    packageManager: string
    engines: Record<string, string>
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    workspaces?: string[]
    overrides?: Record<string, string>
  }
}

/** bun.lock is JSON with trailing commas, so the commas go before the parse. */
async function lockfile() {
  const text = await Bun.file(`${root}/bun.lock`).text()
  return JSON.parse(text.replace(/,(\s*[}\]])/g, '$1')) as {
    lockfileVersion: number
    workspaces: Record<
      string,
      { name: string; dependencies?: Record<string, string>; devDependencies?: Record<string, string> }
    >
    overrides?: Record<string, string>
    packages: Record<string, [string] | [string, string, object, string]>
  }
}

test('the root manifest declares every runtime package as a workspace member', async () => {
  const rootManifest = await manifest('.')
  expect([...(rootManifest.workspaces || [])].sort()).toEqual([...members].sort())
})

test('one committed lockfile at the root describes the whole monorepo', async () => {
  expect(await Bun.file(`${root}/bun.lock`).exists()).toBe(true)
  for (const directory of members)
    expect(await Bun.file(`${root}/${directory}/bun.lock`).exists(), `${directory}/bun.lock`).toBe(false)
  const tracked = spawnSync('git', ['ls-files', '--error-unmatch', 'bun.lock'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
  })
  // 128 means the tree was unpacked without git, where tracked-ness cannot be checked.
  expect([0, 128], tracked.stderr).toContain(tracked.status)
  expect(tracked.status === 0 ? tracked.stdout.trim() : 'bun.lock').toBe('bun.lock')

  const lock = await lockfile()
  expect(Object.keys(lock.workspaces).sort()).toEqual(['', ...members].sort())
  expect(Object.keys(lock.packages).length).toBeGreaterThan(200)
})

test('every declared dependency resolves inside that single lockfile', async () => {
  const lock = await lockfile()
  for (const directory of ['', ...members]) {
    const declared = await manifest(directory)
    const resolved = lock.workspaces[directory]
    expect(resolved.name, directory).toBe(declared.name)
    for (const kind of ['dependencies', 'devDependencies'] as const)
      for (const [name, range] of Object.entries(declared[kind] || {})) {
        expect(resolved[kind]?.[name], `${directory}/${name}`).toBe(range)
        expect(lock.packages[name], `${name} has no locked resolution`).toBeArray()
      }
  }
})

test('shared dependencies resolve once rather than being duplicated per package', async () => {
  const lock = await lockfile()
  const owners = new Map<string, string[]>()
  for (const directory of members)
    for (const kind of ['dependencies', 'devDependencies'] as const)
      for (const name of Object.keys(lock.workspaces[directory][kind] || {}))
        owners.set(name, [...(owners.get(name) || []), directory])
  const shared = [...owners].filter(([, list]) => list.length > 1)
  expect(shared.length).toBeGreaterThan(5)
  for (const [name, list] of shared) {
    const entry = lock.packages[name]
    // A second resolution for the same name would arrive as a nested list of entries.
    expect(Array.isArray(entry), `${name} is resolved by ${list.join(', ')}`).toBe(true)
    expect(typeof entry[0], `${name} is resolved by ${list.join(', ')}`).toBe('string')
  }
})

test('the workspace lock carries no phantom dependency', async () => {
  const lock = await lockfile()
  // Bun 1.4.2 writes "4": "^0.0.0" into the root workspace when a bare-major range like
  // debug:"4" is in the graph, which then fails its own frozen install. 1.4.4 fixed it.
  expect(lock.packages['4']).toBeUndefined()
  for (const workspace of Object.values(lock.workspaces))
    for (const kind of ['dependencies', 'devDependencies'] as const)
      expect(workspace[kind]?.['4'], workspace.name).toBeUndefined()
  expect(Object.keys(lock.packages).some((key) => /^4@/.test(key))).toBe(false)
})

test('every manifest asks for the Bun that can write this lock', async () => {
  const versions = new Set<string>()
  for (const directory of ['', ...members]) {
    const declared = await manifest(directory)
    const pinned = declared.packageManager.slice('bun@'.length)
    expect(declared.packageManager, directory).toMatch(/^bun@\d+\.\d+\.\d+$/)
    expect(declared.engines.bun, directory).toBe(`>=${pinned}`)
    versions.add(pinned)
  }
  expect(versions.size).toBe(1)
  const [pinned] = versions
  for (const file of ['.github/workflows/ci.yml', 'Dockerfile']) {
    const text = await Bun.file(`${root}/${file}`).text()
    expect(text, `${file} must use Bun ${pinned}`).toContain(pinned)
    // 1.4.2 and earlier cannot regenerate this lock without corrupting it.
    for (const line of text.split(/\r?\n/))
      expect(line, `${file} pins an obsolete Bun`).not.toMatch(/1\.4\.[0-3]\b/)
  }
  const running = spawnSync(process.execPath, ['--version'], { encoding: 'utf8', windowsHide: true })
  expect((running.stdout || '').trim(), `Bun ${pinned} is the pinned installer and test runtime`).toBe(pinned)
})

test('CI installs the workspace once with the committed lock and never a per-package lock', async () => {
  const ci = await Bun.file(`${root}/.github/workflows/ci.yml`).text()
  expect(ci).toContain('bun install --frozen-lockfile')
  expect(ci).not.toContain('cd client && bun install')
  expect(ci).not.toContain('bun run setup')
  const dockerfile = await Bun.file(`${root}/Dockerfile`).text()
  expect(dockerfile).toContain('COPY package.json bun.lock ./')
  expect(dockerfile).toContain('bun install --frozen-lockfile --filter @erect3d/api')
})
