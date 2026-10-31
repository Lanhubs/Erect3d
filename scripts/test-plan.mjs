import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const packages = ['.', 'client', 'api', 'motion-video']

/** A suite that only runs against the disposable database is named by convention, not by guesswork. */
export const integrationSuffix = '.integration.test.ts'

export const missingDatabaseMessage =
  'Integration tests require an explicit disposable TEST_DATABASE_URL ending in _test. Run "bun run test:prepare" first.'

/** The guard is only satisfied by a URL that was actually handed to the test tooling. */
export function databaseReady(environment) {
  const url = environment.TEST_DATABASE_URL
  if (!url) return false
  try {
    return new URL(url).pathname.endsWith('_test')
  } catch {
    return false
  }
}

export function integrationSuites(root = fileURLToPath(new URL('../', import.meta.url))) {
  const found = []
  for (const directory of packages) {
    let entries = []
    try {
      entries = readdirSync(`${root}/${directory}/tests`)
    } catch {
      continue
    }
    for (const entry of entries.sort())
      if (entry.endsWith(integrationSuffix)) found.push(`${directory}/tests/${entry}`)
  }
  return found
}

/** Bun treats a bare directory argument as a filter, so a suite set is listed file by file. */
export function integrationFiles(directory, root = fileURLToPath(new URL('../', import.meta.url))) {
  let entries = []
  try {
    entries = readdirSync(`${root}/${directory}/tests`)
  } catch {
    return []
  }
  return entries
    .filter((entry) => entry.endsWith(integrationSuffix))
    .sort()
    .map((entry) => `tests/${entry}`)
}

export function skippedNotice(files) {
  if (!files.length) return 'No database-backed suites exist in this repository.'
  return [
    `Database suites skipped: ${files.length} (no disposable TEST_DATABASE_URL was supplied).`,
    ...files.map((file) => `  - ${file}`),
    'Nothing above ran. Unlock them with "bun run test:prepare" and then "bun run test".',
  ].join('\n')
}
