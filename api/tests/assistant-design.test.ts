import { expect, test } from 'bun:test'
import { fixture } from './helpers'
import { EditWorkspace } from '../src/modules/assistant/edits'
import { executeTool } from '../src/modules/assistant/tools'
import { editingContext } from '../src/modules/assistant/context'

function setup() {
  const p = fixture(),
    b = p.buildings[0],
    l = b.levels[0]
  l.walls = []
  const work = new EditWorkspace(p, { mode: 'level', buildingId: b.id, levelId: l.id })
  const polygon = [
    { x: 0, z: 0 },
    { x: 8, z: 0 },
    { x: 8, z: 6 },
    { x: 0, z: 6 },
  ]
  const input = {
    levelId: l.id,
    rooms: [{ name: 'Dream lounge', polygon, material: 'timber' }],
    walls: polygon.map((start, i) => ({
      ref: `w${i}`,
      start,
      end: polygon[(i + 1) % 4],
      height: 3,
      thickness: 0.2,
      material: 'plaster',
    })),
    doors: [{ hostRef: 'w0', offset: 1, width: 1, height: 2.1, hinge: 'left' }],
    windows: [{ hostRef: 'w2', offset: 2, width: 2, height: 1.5, sill: 0.9 }],
  }
  return { p, l, b, work, input }
}
test('a source-free brief compiles to real editable walls, hosted openings, room and exact slab', () => {
  const { p, work, input } = setup()
  const result = executeTool(work, 'design_floor', input) as any
  const proposal = work.proposal(),
    level = proposal.document.buildings[0].levels[0]
  expect(result.changes).toBeGreaterThan(0)
  expect(level.walls).toHaveLength(4)
  expect(level.doors[0].wallId).toBe(result.walls.w0)
  expect(level.rooms[0].name).toBe('Dream lounge')
  expect(level.slabs?.[0].polygon).toHaveLength(4)
  expect(level.slabs?.[0].autoFromWalls).toBe(false)
  expect(p.buildings[0].levels[0].rooms).toEqual([])
  expect(() => executeTool(work, 'design_floor', input)).toThrow('empty')
})
test('invalid host references roll back the entire generated layout', () => {
  const { work, input, p } = setup()
  input.doors[0].hostRef = 'missing'
  expect(() => executeTool(work, 'design_floor', input)).toThrow('references')
  expect(work.document).toEqual(p)
  expect(work.descriptions).toEqual([])
})
test('the exact selected room is included beyond capped floor summaries; furniture stays in that room', () => {
  const { p, b, l } = setup()
  l.rooms = Array.from({ length: 40 }, (_, i) => ({
    id: `room${i}`,
    name: i === 39 ? '2-car garage' : `Space ${i}`,
    material: 'concrete',
    polygon: [
      { x: 0, z: 0 },
      { x: 8, z: 0 },
      { x: 8, z: 6 },
      { x: 0, z: 6 },
    ],
  }))
  const work = new EditWorkspace(p, {
    mode: 'selection',
    buildingId: b.id,
    levelId: l.id,
    entityId: 'room39',
  })
  const context = editingContext(work) as any
  expect(context.targetFloor.rooms).toHaveLength(30)
  expect(context.selection.element.name).toBe('2-car garage')
  work.apply({
    action: 'create',
    kind: 'furniture',
    levelId: l.id,
    properties: JSON.stringify({
      type: 'sofa',
      assetId: 'sofa',
      roomId: 'room39',
      position: { x: 50, z: 50 },
      rotation: 0,
      width: 2.2,
      depth: 0.95,
      height: 0.85,
    }),
  })
  expect(() => work.proposal()).toThrow('target room')
})
