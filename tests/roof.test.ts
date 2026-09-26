import { expect, test } from 'bun:test'
import { defaultRoof, type RoofShape } from '../src/domain/types'
import { roofLayout } from '../src/geometry/roof'
import { fixtureProject } from '../src/domain/fixture'
import { levelOf } from '../src/domain/types'
import { useProject } from '../src/state/project'

const bounds = { minX: 0, maxX: 12, minZ: 0, maxZ: 8, top: 2.9 }

test('all roof forms produce finite surfaces over the building footprint', () => {
  for (const shape of ['hidden', 'gable', 'hip', 'shed'] as RoofShape[]) {
    const layout = roofLayout(bounds, { ...defaultRoof, shape })
    expect(layout.faces.length).toBeGreaterThan(0)
    expect(layout.faces.flat(2).every(Number.isFinite)).toBe(true)
    expect(layout.faces.flat().some((point) => point[1] > bounds.top)).toBe(true)
  }
})

test('shed roof has wall infill rather than floating above the house', () => {
  const layout = roofLayout(bounds, { ...defaultRoof, shape: 'shed', pitch: 12 })
  expect(layout.gables.length).toBeGreaterThanOrEqual(3)
  expect(layout.gables.flat().some(point => point[1] === bounds.top)).toBe(true)
  expect(layout.gables.flat().some(point => point[1] > bounds.top + 1)).toBe(true)
})

test('roof choices remain part of edits and undo history', () => {
  const project = fixtureProject()
  useProject.getState().setProject(project)
  useProject.getState().edit(model => ({ ...model, roof: { ...defaultRoof, shape: 'gable' } }))
  expect(levelOf(useProject.getState().project!).roof?.shape).toBe('gable')
  useProject.getState().undo()
  expect(levelOf(useProject.getState().project!).roof?.shape).toBe('hip')
  useProject.getState().redo()
  expect(levelOf(useProject.getState().project!).roof?.shape).toBe('gable')
})
