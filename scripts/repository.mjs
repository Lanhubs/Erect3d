import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const packages = ['client', 'api', 'motion-video']
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
} else if (task === 'typecheck' || task === 'test') {
  if (
    task === 'test' &&
    (!process.env.TEST_DATABASE_URL || !new URL(process.env.TEST_DATABASE_URL).pathname.endsWith('_test'))
  ) {
    throw new Error('Tests require an explicit disposable TEST_DATABASE_URL ending in _test')
  }
  if (task === 'test') run(['test', 'scripts/tests'])
  for (const directory of packages) run(['run', task], directory)
  if (task === 'typecheck') run(['run', 'check:lines'], 'api')
} else if (task === 'audit') {
  for (const directory of ['.', ...packages]) run(['audit', '--audit-level=high'], directory)
} else {
  throw new Error(`Unknown repository task: ${task}`)
}
