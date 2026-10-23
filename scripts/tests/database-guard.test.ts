import { expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
test('test preparation refuses a live database fallback before launching migrations', () => {
  for (const testUrl of ['', 'postgres://fixture:fixture@127.0.0.1:1/live_projects']) {
    const result = spawnSync(process.execPath, ['scripts/test-database.mjs'], {
      cwd: root,
      env: {
        ...process.env,
        TEST_DATABASE_URL: testUrl,
        DATABASE_URL: 'postgres://fixture:fixture@127.0.0.1:1/live_projects',
      },
      encoding: 'utf8',
      windowsHide: true,
      timeout: 5000,
    })
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('Set TEST_DATABASE_URL')
    expect(result.stdout).not.toContain('Applied ')
  }
})

test('repository test command requires explicit test isolation before running package suites', () => {
  const result = spawnSync(process.execPath, ['scripts/repository.mjs', 'test'], {
    cwd: root,
    env: {
      ...process.env,
      TEST_DATABASE_URL: '',
      DATABASE_URL: 'postgres://fixture:fixture@127.0.0.1:1/live_projects',
    },
    encoding: 'utf8',
    windowsHide: true,
    timeout: 5000,
  })
  expect(result.status).not.toBe(0)
  expect(result.stderr).toContain('explicit disposable TEST_DATABASE_URL')
  expect(result.stdout).not.toContain('bun test')
})
