import { afterAll, expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const lines = (file: string) =>
  Bun.file(join(root, file))
    .text()
    .then((text) => text.trimEnd().split(/\r?\n/).length)

/** The CAD feature is new work, so every module it owns carries its own single responsibility. */
const cadScope = [
  'api/src/modules/cad/*.ts',
  'api/src/workers/cad-export.ts',
  'api/src/workers/dwg-export.ts',
  'api/src/modules/assistant/plan-reference.ts',
  'client/src/cad/*.ts',
  'client/src/cad/ExportMenu.tsx',
  'client/src/cloud/cadExport.ts',
  'client/src/features/import/cadFormat.ts',
  'client/src/features/import/cadImport.ts',
  'client/src/features/import/cadTransfer.ts',
]

test('every CAD module stays inside the budget for new files', async () => {
  const offenders: string[] = []
  for (const scope of cadScope) {
    const matched = [...new Bun.Glob(scope).scanSync(root)]
    expect(matched.length, `no file matches ${scope}`).toBeGreaterThan(0)
    for (const file of matched) {
      const relative = file.replaceAll('\\', '/'),
        count = await lines(relative)
      if (count > 200) offenders.push(`${relative}: ${count} > 200`)
    }
  }
  expect(offenders).toEqual([])
})

test('the existing files the CAD feature touched stay under the three hundred line ceiling', async () => {
  const touched = [
    'api/src/modules/assistant/run.ts',
    'api/src/modules/assets/optimized-upload.ts',
    'api/src/modules/assets/sources.ts',
    'api/src/modules/exports/routes.ts',
    'api/src/modules/plan-analysis/service.ts',
    'api/src/workers/exports.ts',
    'client/src/app/WorkspaceHeader.tsx',
    'client/src/app/SourceStrip.tsx',
    'client/src/cloud/sources.ts',
    'client/src/features/import/usePlanSource.ts',
  ]
  const offenders: string[] = []
  for (const file of touched) {
    const count = await lines(file)
    if (count > 300) offenders.push(`${file}: ${count} > 300`)
  }
  expect(offenders).toEqual([])
})

test('the frozen baselines still describe the files they freeze', async () => {
  const api: Record<string, number> = await Bun.file(join(root, 'tools/api-file-size-baselines.json')).json()
  const client: Record<string, number> = await Bun.file(
    join(root, 'tools/client-file-size-baselines.json'),
  ).json()
  const drift: string[] = []
  for (const [package_, baseline] of [
    ['api', api],
    ['client', client],
  ] as const)
    for (const [file, recorded] of Object.entries(baseline)) {
      const text = await Bun.file(join(root, package_, file))
        .text()
        .catch(() => null)
      if (text === null) drift.push(`${package_}/${file} was deleted but is still baselined`)
      else {
        const count = text.trimEnd().split(/\r?\n/).length
        if (count > recorded) drift.push(`${package_}/${file}: ${count} > frozen ${recorded}`)
      }
    }
  expect(drift).toEqual([])
})

test('both size guards reject a file that only exists to be too long', async () => {
  const probe = Array.from({ length: 301 }, (_line, index) => `// size probe ${index}`).join('\n') + '\n',
    written: string[] = []
  try {
    for (const package_ of ['api', 'client']) {
      const file = join(root, package_, 'src/size-probe.ts')
      await writeFile(file, probe)
      written.push(file)
      const result = spawnSync(process.execPath, ['run', 'check:lines'], {
        cwd: join(root, package_),
        env: process.env,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 60000,
      })
      expect(result.status, `${package_}: ${result.stderr}`).not.toBe(0)
      expect(result.stderr).toContain('src/size-probe.ts')
      expect(result.stderr).toContain('(limit 200; extract a focused module)')
    }
  } finally {
    await Promise.all(written.map((file) => rm(file, { force: true })))
  }
})

afterAll(async () => {
  await rm(join(root, 'api/src/size-probe.ts'), { force: true })
  await rm(join(root, 'client/src/size-probe.ts'), { force: true })
})
