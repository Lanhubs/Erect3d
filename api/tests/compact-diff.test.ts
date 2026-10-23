import { expect, test } from 'bun:test'
import { compactDocumentChanges } from '../client/compact-diff'
import { documentChanges } from '../client/diff'
import { applyChanges } from '../src/modules/projects/patch'
import { changeEntityIds } from '../src/modules/projects/change-locks'
import { fixture } from './helpers'
test('large reconstruction and its Undo are atomic bounded replacements with identical documents', () => {
  const before = fixture(),
    level = before.buildings[0].levels[0],
    wall = level.walls[0]
  level.walls = Array.from({ length: 300 }, (_, index) => ({ ...wall, id: `old_${index}` }))
  before.interpretation = Object.fromEntries(
    level.walls.map((item) => [item.id, { origin: 'detected' as const, confirmedFields: [] }]),
  )
  const after = structuredClone(before)
  after.buildings[0].levels[0].walls = Array.from({ length: 300 }, (_, index) => ({
    ...wall,
    id: `new_${index}`,
  }))
  after.interpretation = Object.fromEntries(
    after.buildings[0].levels[0].walls.map((item) => [
      item.id,
      { origin: 'detected' as const, confirmedFields: [] },
    ]),
  )
  expect(documentChanges(before, after).length).toBeGreaterThan(512)
  const forward = compactDocumentChanges(before, after),
    undo = compactDocumentChanges(after, before)
  expect(forward).toHaveLength(2)
  expect(undo).toHaveLength(2)
  expect(applyChanges(before, forward, after.modified)).toEqual(after)
  expect(applyChanges(after, undo, before.modified)).toEqual(before)
  const affected = changeEntityIds(before, forward)
  expect(affected).toContain('old_299')
  expect(affected).toContain('new_299')
  expect(affected).toContain(level.id)
})
test('ordinary edits stay granular and compound changes include overwritten entity lock identities', () => {
  const before = fixture(),
    after = structuredClone(before),
    building = after.buildings[0]
  building.levels[0].walls[0].height = 4
  expect(compactDocumentChanges(before, after)).toEqual(documentChanges(before, after))
  const replacement = {
    action: 'put' as const,
    path: ['buildings', building.id, 'levels', building.levels[0].id],
    value: building.levels[0],
  }
  expect(changeEntityIds(before, [replacement])).toContain(building.levels[0].walls[0].id)
})
