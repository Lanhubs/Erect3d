import { expect, test } from 'bun:test'
import { resolveAssistantFloor } from '../src/domain/assistantFloor'
import { assistantRequestId } from '../src/cloud/assistantDelivery'
import type { AssistantRun } from '../src/cloud/assistantTypes'
import { blankLevel } from '../src/domain/levels'

const building = {
  levels: [blankLevel('Ground floor', 0), blankLevel('First floor', 3), blankLevel('Second floor', 6)],
}
const ground = building.levels[0],
  second = building.levels[2]
const scope = { mode: 'level' as const, levelId: ground.id }
test('explicit floor names and ordinals resolve without assuming the active floor or array position', () => {
  for (const name of ['second floor', '2nd floor', 'floor 2', 'level 2'])
    expect(
      resolveAssistantFloor(building, scope, `add some furnitures like couch, tv and more to ${name}`)
        .levelId,
    ).toBe(second.id)
  expect(
    resolveAssistantFloor({ levels: [...building.levels].reverse() }, scope, 'furnish second floor').levelId,
  ).toBe(second.id)
  expect(resolveAssistantFloor(building, scope, 'change the roof material').levelId).toBe(ground.id)
})
test('missing or ambiguous floors and selections ask a question instead of editing another floor', () => {
  expect(resolveAssistantFloor(building, scope, 'furnish fourth floor').question).toContain(
    'Which existing floor',
  )
  expect(resolveAssistantFloor(building, scope, 'copy from first floor to second floor').question).toContain(
    'Whole building',
  )
  expect(
    resolveAssistantFloor(
      { levels: [...building.levels, blankLevel('Level 2', 9)] },
      scope,
      'furnish second floor',
    ).question,
  ).toContain('Which single floor')
  expect(
    resolveAssistantFloor(building, { ...scope, mode: 'selection' }, 'furnish second floor').question,
  ).toContain('Choose This floor')
  expect(
    resolveAssistantFloor(building, { ...scope, mode: 'building' }, 'furnish second floor').levelId,
  ).toBe(ground.id)
})
test('ambiguous delivery reuses its key, while retrying a known failed run starts a fresh request', () => {
  const input = { message: 'furnish second floor', baseRevision: 4 }
  const cached = { input, id: 'lost-response-key' }
  const run = { base_revision: 4, status: 'failed' } as AssistantRun
  expect(assistantRequestId(input, cached, null)).toBe(cached.id)
  expect(assistantRequestId(input, cached, { ...run, status: 'running' }, input.message)).toBe(cached.id)
  expect(assistantRequestId(input, cached, run, input.message)).not.toBe(cached.id)
  expect(assistantRequestId(input, cached, { ...run, status: 'cancelled' }, input.message)).not.toBe(
    cached.id,
  )
  expect(assistantRequestId(input, cached, run, 'another prompt')).toBe(cached.id)
})
