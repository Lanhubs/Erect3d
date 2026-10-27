import { expect } from 'bun:test'
import type { Database } from '../src/db/connection'
export async function expectDirectProgress(db: Database, projectId: string) {
  const events =
    await db`SELECT payload FROM realtime_events WHERE project_id=${projectId} AND type='analysis.progress' ORDER BY id`
  expect(
    events.map((event: { payload: { progress: { current: string } } }) => event.payload.progress.current),
  ).toEqual([
    'measure-source',
    'read-source-text',
    'reconstruct-model',
    'model-validation',
    'validated-model-repair-1',
  ])
}
