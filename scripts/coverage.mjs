import { spawnSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { summarizeLcov, checkBaseline } from './coverage-summary.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const baselineFile = new URL('../tools/coverage-baselines.json', import.meta.url)
const record = process.argv.includes('--record-baseline')
if (record && process.env.CI) throw new Error('CI cannot rewrite coverage baselines')
if (!process.env.TEST_DATABASE_URL || !new URL(process.env.TEST_DATABASE_URL).pathname.endsWith('_test')) {
  throw new Error('Coverage requires an explicit disposable TEST_DATABASE_URL ending in _test')
}
const baselines = record ? {} : JSON.parse(await readFile(baselineFile, 'utf8'))
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
  results[name] = { ...actual, sourceFiles: inventory, scope: 'owned production modules imported by tests' }
  if (record)
    baselines[name] = {
      linePercent: Math.floor(actual.linePercent),
      functionPercent: Math.floor(actual.functionPercent),
      files: actual.files,
    }
  else {
    if (!baselines[name]) throw new Error(`Missing baseline: ${name}`)
    const regressions = checkBaseline(actual, baselines[name])
    if (regressions.length) throw new Error(`${name} coverage regressed: ${regressions.join(', ')}`)
  }
}
await mkdir(`${root}/coverage`, { recursive: true })
await writeFile(`${root}/coverage/summary.json`, JSON.stringify(results, null, 2) + '\n')
if (record) await writeFile(baselineFile, JSON.stringify(baselines, null, 2) + '\n')
console.table(results)
