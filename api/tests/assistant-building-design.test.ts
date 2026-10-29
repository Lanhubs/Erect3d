import { expect, test } from 'bun:test'
import { fixture } from './helpers'
import { EditWorkspace } from '../src/modules/assistant/edits'
import { executeTool } from '../src/modules/assistant/tools'
import { buildingCreationBrief } from '../../client/src/domain/assistantCreation'
import { buildingDesignFixture } from './building-design-fixture'

function setup() {
  const p = fixture(),
    b = p.buildings[0],
    w = new EditWorkspace(p, { mode: 'building', buildingId: b.id, levelId: b.levels[0].id })
  w.creation = buildingCreationBrief('craft a 2 storey mansion with furniture')
  return { p, w, input: buildingDesignFixture() }
}
test('whole-building design erects both furnished storeys, style geometry and a real connected stair opening', () => {
  const { p, w, input } = setup(),
    before = structuredClone(p)
  executeTool(w, 'design_building', input)
  const result = w.proposal(),
    b = result.document.buildings[0]
  expect(b.levels).toHaveLength(2)
  expect(b.levels[1].elevation).toBe(3.4)
  expect(b.levels.every((l) => l.furniture!.length === 2)).toBe(true)
  expect(b.levels[0].stairs![0].toLevelId).toBe(b.levels[1].id)
  expect(b.levels[1].slabs!.some((s) => s.openings.some((o) => o.kind === 'stair'))).toBe(true)
  expect(b.roof!.material).toBe('clay-tile')
  expect(b.levels[0].details![0].kind).toBe('screen')
  expect(result.focusLevelId).toBe(b.levels[0].id)
  expect(p).toEqual(before)
})
test('wrong storey counts, unconnected floors and missing requested furniture cannot masquerade as complete buildings', () => {
  for (const flaw of ['count', 'stair', 'furniture'] as const) {
    const { p, w, input } = setup()
    if (flaw === 'count') input.floors.pop()
    if (flaw === 'stair') input.stairs = []
    if (flaw === 'furniture') input.floors[1].furniture = []
    expect(() => executeTool(w, 'design_building', input)).toThrow()
    expect(w.document).toEqual(p)
    expect(w.descriptions).toEqual([])
  }
})
test('ordinary editing prompts cannot call the building-replacement tool and locked work is preserved', () => {
  const { w, input } = setup()
  w.creation = undefined
  expect(() => executeTool(w, 'design_building', input)).toThrow('new-building')
  w.creation = buildingCreationBrief('craft a new mansion')
  w.document.buildings[0].levels[0].locked = true
  expect(() => executeTool(w, 'design_building', input)).toThrow('Unlock')
})
