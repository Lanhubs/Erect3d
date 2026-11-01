import { spawnSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { summarizeLcov, checkBaseline } from './coverage-summary.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const baselineFile = new URL('../tools/coverage-baselines.json', import.meta.url)
const record = process.argv.includes('--record-baseline')
// Bun changes what it instruments between patch releases, so a percentage only means something
// beside a floor measured by the same release. Floors are keyed by the version that produced them.
const toolchain = Bun.version
if (record && process.env.CI) throw new Error('CI cannot rewrite coverage baselines')
if (!process.env.TEST_DATABASE_URL || !new URL(process.env.TEST_DATABASE_URL).pathname.endsWith('_test')) {
  throw new Error('Coverage requires an explicit disposable TEST_DATABASE_URL ending in _test')
}
const floors = JSON.parse(await readFile(baselineFile, 'utf8'))
const baselines = record ? (floors[toolchain] ??= {}) : floors[toolchain]
if (!record && !baselines)
  throw new Error(
    `No coverage floors are recorded for Bun ${toolchain}. ` +
      'Run "bun scripts/coverage.mjs --record-baseline" on this toolchain and review the diff.',
  )
const results = {}
for (const name of ['client', 'api', 'motion-video']) {
  const result = spawnSync(
    'bun',
    ['test', 'tests', '--timeout=20000', '--coverage', '--coverage-reporter=lcov'],
    {
      cwd: `${root}/${name}`,
      stdio: 'inherit',
      windowsHide: true,
    },
  )
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status || 1)
  const report = await readFile(`${root}/${name}/coverage/lcov.info`, 'utf8')
  const actual = summarizeLcov(
    report,
    (file) => file.startsWith('src/') || (name === 'api' && file.startsWith('client/')),
  )
  // Bun instruments imported modules. Publish this scope instead of claiming whole-app coverage.
  const inventory = [
    ...new Bun.Glob(
      name === 'api' ? '{src,client}/**/*.{ts,tsx,js,jsx}' : 'src/**/*.{ts,tsx,js,jsx}',
    ).scanSync(`${root}/${name}`),
  ].length
  results[name] = {
    ...actual,
    sourceFiles: inventory,
    bun: toolchain,
    scope: 'owned production modules imported by tests',
  }
  if (record)
    baselines[name] = {
      linePercent: Math.floor(actual.linePercent),
      functionPercent: Math.floor(actual.functionPercent),
      files: actual.files,
    }
  else {
    if (!baselines[name]) throw new Error(`Missing baseline for Bun ${toolchain}: ${name}`)
    const regressions = checkBaseline(actual, baselines[name])
    if (regressions.length)
      throw new Error(
        `${name} coverage regressed below the Bun ${toolchain} floors: ${regressions.join(', ')}`,
      )
  }
}
await mkdir(`${root}/coverage`, { recursive: true })
await writeFile(`${root}/coverage/summary.json`, JSON.stringify(results, null, 2) + '\n')
if (record) await writeFile(baselineFile, JSON.stringify(floors, null, 2) + '\n')
console.table(results)
