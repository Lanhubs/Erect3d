import { expect, test } from 'bun:test'
import { assistantStarterRequest, assistantStarters } from '../src/cloud/assistantStarters'
import { fixtureProject } from '../src/domain/fixture'
import { blankLevel } from '../src/domain/levels'

test('floor shortcuts send a concrete request for the active floor, independent of selected elements', () => {
  const project = fixtureProject(),
    building = project.buildings[0],
    upper = blankLevel('Second floor', 6, 3)
  building.levels.push(upper)
  for (const starter of ['review', 'improve', 'roof'] as const) {
    const request = assistantStarterRequest(project, upper.id, starter)
    expect(request.scope).toEqual({ mode: 'level', buildingId: building.id, levelId: upper.id })
    expect(request.message).toBe(assistantStarters[starter].message)
    expect(request.fresh).toBe(true)
    expect(request.scope).not.toHaveProperty('entityId')
  }
})
test('shortcuts do not fall back to another floor or bypass floor locks', () => {
  const project = fixtureProject(),
    floor = project.buildings[0].levels[0]
  expect(() => assistantStarterRequest(project, 'removed-floor', 'review')).toThrow('Open a floor')
  expect(() => assistantStarterRequest(null, null, 'review')).toThrow('Open a floor')
  floor.locked = true
  expect(() => assistantStarterRequest(project, floor.id, 'improve')).toThrow('Unlock this floor')
})
