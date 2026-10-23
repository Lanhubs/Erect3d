import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// Never inherit DATABASE_URL: preparation must not migrate a developer's live database.
const url = process.env.TEST_DATABASE_URL
if (!url || !new URL(url).pathname.endsWith('_test')) {
  throw new Error('Set TEST_DATABASE_URL to a disposable PostgreSQL database ending in _test.')
}
const result = spawnSync('bun', ['run', 'migrate'], {
  cwd: fileURLToPath(new URL('../api/', import.meta.url)),
  env: { ...process.env, DATABASE_URL: url, NODE_ENV: 'test' },
  stdio: 'inherit',
  windowsHide: true,
})
if (result.error) throw result.error
process.exit(result.status ?? 1)
