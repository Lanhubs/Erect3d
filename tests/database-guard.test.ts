import { expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  databaseReady,
  integrationSuites,
  missingDatabaseMessage,
  skippedNotice,
} from '../scripts/test-plan.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const live = { DATABASE_URL: 'postgres://fixture:fixture@127.0.0.1:1/live_projects' }
test('test preparation refuses a live database fallback before launching migrations', () => {
  for (const testUrl of ['', 'postgres://fixture:fixture@127.0.0.1:1/live_projects']) {
    const result = spawnSync(process.execPath, ['scripts/test-database.mjs'], {
      cwd: root,
      env: { ...process.env, ...live, TEST_DATABASE_URL: testUrl },
      encoding: 'utf8',
      windowsHide: true,
      timeout: 5000,
    })
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('Set TEST_DATABASE_URL')
    expect(result.stdout).not.toContain('Applied ')
  }
})

test('integration suites refuse to start without an explicit disposable database', () => {
  const result = spawnSync(process.execPath, ['scripts/repository.mjs', 'test:integration'], {
    cwd: root,
    env: { ...process.env, ...live, TEST_DATABASE_URL: '' },
    encoding: 'utf8',
    windowsHide: true,
    timeout: 5000,
  })
  expect(result.status).not.toBe(0)
  expect(result.stderr).toContain('explicit disposable TEST_DATABASE_URL')
  expect(result.stdout).not.toContain('bun test')
})

test('the isolation guard only accepts a database name ending in _test', () => {
  expect(databaseReady({ ...live, TEST_DATABASE_URL: '' })).toBe(false)
  expect(databaseReady({ ...live })).toBe(false)
  expect(databaseReady({ TEST_DATABASE_URL: 'postgres://u:p@127.0.0.1:5432/live_projects' })).toBe(false)
  expect(databaseReady({ TEST_DATABASE_URL: 'postgres://u:p@127.0.0.1:5432/erect_api_test' })).toBe(true)
})

test('a database-less run names every suite it is skipping', () => {
  const files = integrationSuites()
  expect(files.length).toBeGreaterThan(0)
  expect(files.every((file) => file.endsWith('.integration.test.ts'))).toBe(true)
  const notice = skippedNotice(files)
  expect(notice).toContain(`Database suites skipped: ${files.length}`)
  expect(notice).toContain('api/tests')
  expect(notice).toContain('bun run test:prepare')
  expect(missingDatabaseMessage).toContain('bun run test:prepare')
})
