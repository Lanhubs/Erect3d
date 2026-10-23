import { expect, test } from 'bun:test'
import { analysisEvent } from '../src/cloud/analysisEvents'
import { watchAnalysis } from '../src/cloud/watchAnalysis'
test('connected reconstruction consumes pushed progress and stops reads after a terminal result', async () => {
  const project = 'push-qa',
    states: string[] = []
  let calls = 0,
    status = 'pending'
  analysisEvent(project, 'connection.open')
  const stop = watchAnalysis(
    project,
    'job',
    async () => {
      calls++
      return { status, job_status: status === 'pending' ? 'running' : 'completed' }
    },
    (state) => states.push(state.progress?.current || state.status),
    () => {},
    10,
  )
  await Bun.sleep(1)
  for (let n = 0; n < 12; n++)
    analysisEvent(project, 'analysis.progress', {
      analysisId: 'job',
      progress: { current: 'reconstruct-model', completed: [], stages: ['reconstruct-model'] },
    })
  await Bun.sleep(20)
  expect(calls).toBe(1)
  expect(states).toContain('reconstruct-model')
  status = 'ready'
  analysisEvent(project, 'analysis.ready', { analysisId: 'job' })
  await Bun.sleep(1)
  analysisEvent(project, 'connection.close')
  await Bun.sleep(25)
  expect(calls).toBe(2)
  expect(states.at(-1)).toBe('ready')
  stop()
})
test('disconnected fallback never overlaps requests and ignores another drawing', async () => {
  const project = 'fallback-qa'
  let calls = 0,
    active = 0,
    maximum = 0
  const stop = watchAnalysis(
    project,
    'job',
    async () => {
      calls++
      active++
      maximum = Math.max(maximum, active)
      await Bun.sleep(20)
      active--
      return { status: 'pending', job_status: 'running' }
    },
    () => {},
    () => {},
    10,
  )
  analysisEvent(project, 'analysis.ready', { analysisId: 'other-job' })
  await Bun.sleep(55)
  stop()
  expect(maximum).toBe(1)
  expect(calls).toBe(2)
  await Bun.sleep(25)
  expect(calls).toBe(2)
})
