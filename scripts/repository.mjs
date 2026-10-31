import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  databaseReady,
  integrationFiles,
  integrationSuffix,
  integrationSuites,
  missingDatabaseMessage,
  skippedNotice,
} from './test-plan.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const packages = ['client', 'api', 'motion-video']
const unitArguments = [
  'test',
  'tests',
  '--timeout=20000',
  '--path-ignore-patterns',
  `**/*${integrationSuffix}`,
]
export function run(args, directory = '.') {
  const result = spawnSync('bun', args, { cwd: `${root}/${directory}`, stdio: 'inherit', windowsHide: true })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status || 1)
}
const task = process.argv[2]
if (task?.startsWith('dev:')) {
  const targets = {
    api: ['api', 'dev'],
    client: ['client', 'dev'],
    worker: ['api', 'worker'],
    film: ['motion-video', 'dev'],
  }
  const target = targets[task.slice(4)]
  if (!target) throw new Error(`Unknown development target: ${task}`)
  run(['run', target[1]], target[0])
} else if (task === 'build') {
  run(['run', 'build'], 'client')
} else if (task === 'install') {
  for (const directory of packages) run(['install', '--frozen-lockfile'], directory)
} else if (task === 'verify') {
  for (const name of ['lint', 'format:check', 'typecheck', 'test', 'build']) run(['run', name])
} else if (task === 'typecheck') {
  for (const directory of packages) run(['run', task], directory)
  run(['run', 'check:lines'], 'api')
  run(['run', 'check:lines'], 'client')
} else if (task === 'test:unit') {
  run(['run', 'test:repository'])
  for (const directory of packages) run(unitArguments, directory)
} else if (task === 'test:integration') {
  if (!databaseReady(process.env)) throw new Error(missingDatabaseMessage)
  for (const directory of packages) {
    const files = integrationFiles(directory)
    if (files.length) run(['test', '--timeout=20000', ...files], directory)
  }
} else if (task === 'test') {
  run(['run', 'test:repository'])
  if (databaseReady(process.env)) for (const directory of packages) run(['run', 'test'], directory)
  else {
    // A fresh clone still has a suite to run; the skipped files are named instead of hidden.
    console.log(skippedNotice(integrationSuites()))
    for (const directory of packages) run(unitArguments, directory)
  }
} else if (task === 'audit') {
  for (const directory of ['.', ...packages]) run(['audit', '--audit-level=high'], directory)
} else {
  throw new Error(`Unknown repository task: ${task}`)
}
