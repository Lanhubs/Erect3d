import { expect, test } from 'bun:test'
import { blankLevel, newSlab } from '../src/domain/levels'
import { defaultRoof, type Point, type Project } from '../src/domain/types'
import { transformElement, validFootprint } from '../src/domain/elementEditing'
import { selectedElement } from '../src/domain/elementGeometry'
import { rebuildImportedRoof } from '../src/domain/roofDesign'
import { atWall } from '../src/geometry/math'
import { stairOpening } from '../src/geometry/stairs'
import { useProject } from '../src/state/project'
import { editingKey } from '../src/features/editing/editingKeyboard'

const rect = (x: number, z: number, w: number, d: number): Point[] => [
  { x, z },
  { x: x + w, z },
  { x: x + w, z: z + d },
  { x, z: z + d },
]
function project(): Project {
  const level = blankLevel('Ground floor', 0, 3)
  const polygon = rect(0, 0, 6, 4)
  level.walls = polygon.map((p, i) => ({
    id: `wall${i}`,
    start: p,
    end: polygon[(i + 1) % 4],
    thickness: 0.2,
    height: 2.8,
    material: 'plaster',
  }))
  level.doors = [{ id: 'door', wallId: 'wall0', offset: 2, width: 0.9, height: 2.1, hinge: 'left' }]
  level.rooms = [{ id: 'room', name: 'Living', polygon: [...polygon], material: 'tile' }]
  level.slabs = [{ ...newSlab(polygon), id: 'slab' }]
  level.columns = [
    {
      id: 'column',
      position: { x: 3, z: 2 },
      width: 0.3,
      depth: 0.4,
      diameter: 0.3,
      height: 2.8,
      shape: 'rectangular',
      material: 'concrete',
    },
  ]
  const result: Project = {
    id: 'edit',
    name: 'Edit',
    modified: 0,
    units: 'm',
    sources: [],
    buildings: [{ id: 'building', name: 'Building', levels: [level], roof: defaultRoof }],
  }
  rebuildImportedRoof(result.buildings[0], level)
  return result
}
test('wall movement carries its opening, attached corners, slab and fitted roof without mutating the input', () => {
  const original = project(),
    result = transformElement(original, { kind: 'wall', id: 'wall0' }, { move: { x: 0, z: -1 } })
  expect(result.issue).toBeNull()
  const level = result.project.buildings[0].levels[0]
  expect(atWall(level.walls[0], level.doors[0].offset)).toEqual({ x: 2, z: -1 })
  expect(level.walls[1].start.z).toBe(-1)
  expect(level.walls[3].end.z).toBe(-1)
  expect(level.rooms[0].polygon[0].z).toBe(-1)
  expect(level.slabs![0].polygon[0].z).toBe(-1)
  expect(result.project.buildings[0].roofSections![0].footprint.some((p) => p.z === -1)).toBe(true)
  expect(original.buildings[0].levels[0].walls[0].start.z).toBe(0)
})
test('wall resizing rejects an endpoint that would strand its door', () => {
  const original = project(),
    result = transformElement(
      original,
      { kind: 'wall', id: 'wall0' },
      { vertex: { index: 1, point: { x: 2.5, z: 0 } } },
    )
  expect(result.issue).toContain('host wall')
  expect(result.project).toBe(original)
})
test('opening handles and arrow movement stay on the host and cannot overlap or leave it', () => {
  const original = project()
  const moved = transformElement(original, { kind: 'door', id: 'door' }, { move: { x: 0.4, z: 2 } })
  expect(moved.issue).toBeNull()
  expect(moved.project.buildings[0].levels[0].doors[0].offset).toBeCloseTo(2.4)
  const resized = transformElement(
    original,
    { kind: 'door', id: 'door' },
    { vertex: { index: 1, point: { x: 3.2, z: 0 } } },
  )
  expect(resized.project.buildings[0].levels[0].doors[0].width).toBeCloseTo(1.2)
  expect(
    transformElement(original, { kind: 'door', id: 'door' }, { move: { x: 8, z: 0 } }).issue,
  ).toBeTruthy()
})
test('floor and room vertices reject crossing outlines; slab moves carry their voids', () => {
  const original = project(),
    slab = original.buildings[0].levels[0].slabs![0]
  slab.openings = [{ id: 'void', kind: 'void', polygon: rect(2, 1, 0.5, 0.5) }]
  const moved = transformElement(original, { kind: 'slab', id: 'slab' }, { move: { x: 2, z: 1 } })
  expect(moved.issue).toBeNull()
  expect(moved.project.buildings[0].levels[0].slabs![0].openings[0].polygon[0]).toEqual({ x: 4, z: 2 })
  expect(moved.project.buildings[0].levels[0].slabs![0].autoFromWalls).toBe(false)
  expect(moved.project.buildings[0].levels[0].rooms[0].polygon[0]).toEqual({ x: 2, z: 1 })
  expect(moved.project.buildings[0].roofSections![0].footprint.some((p) => p.x === 2 && p.z === 1)).toBe(true)
  expect(
    validFootprint([
      { x: 0, z: 0 },
      { x: 2, z: 2 },
      { x: 0, z: 2 },
      { x: 2, z: 0 },
    ]),
  ).toBe(false)
  expect(
    transformElement(original, { kind: 'slab', id: 'slab' }, { vertex: { index: 1, point: { x: -1, z: 3 } } })
      .issue,
  ).toBeTruthy()
  const thickened = transformElement(original, { kind: 'slab', id: 'slab' }, { height: 0.1 })
  expect(thickened.project.buildings[0].levels[0].slabs![0].thickness).toBeCloseTo(0.3)
  expect(thickened.project.buildings[0].levels[0].slabs![0].elevation).toBe(0)
  expect(transformElement(original, { kind: 'room', id: 'room' }, { height: -4 }).issue).toContain('ceiling')
})
test('columns support rotation, size and height while locked levels reject changes', () => {
  const original = project(),
    result = transformElement(
      original,
      { kind: 'column', id: 'column' },
      { rotate: 30, scale: 2, height: 0.2 },
    )
  expect(result.issue).toBeNull()
  const column = result.project.buildings[0].levels[0].columns![0]
  expect(column.rotation).toBe(30)
  expect(column.width).toBeCloseTo(0.6)
  expect(column.height).toBeCloseTo(3)
  original.buildings[0].levels[0].locked = true
  expect(
    transformElement(original, { kind: 'column', id: 'column' }, { move: { x: 1, z: 0 } }).issue,
  ).toContain('Unlock')
})
test('stairs move their linked upper-floor opening and reject moves beyond the slab', () => {
  const original = project(),
    ground = original.buildings[0].levels[0],
    upper = blankLevel('Upper', 3, 3)
  ground.walls = []
  ground.doors = []
  upper.slabs = [newSlab(rect(-1, -2, 12, 8))]
  const stair = {
    id: 'stair',
    fromLevelId: ground.id,
    toLevelId: upper.id,
    start: { x: 1, z: 1 },
    direction: 0,
    form: 'straight' as const,
    width: 1,
    riserHeight: 0.17,
    treadDepth: 0.28,
    landingLength: 1.2,
    openingId: 'stair-opening',
  }
  ground.stairs = [stair]
  original.buildings[0].levels.push(upper)
  upper.slabs[0].openings = [
    { id: stair.openingId, kind: 'stair', polygon: stairOpening(stair, original.buildings[0].levels) },
  ]
  const moved = transformElement(original, { kind: 'stair', id: 'stair' }, { move: { x: 0.5, z: 0.5 } })
  expect(moved.issue).toBeNull()
  expect(moved.project.buildings[0].levels[1].slabs![0].openings[0].polygon[0].x).toBeCloseTo(
    upper.slabs[0].openings[0].polygon[0].x + 0.5,
  )
  expect(
    transformElement(original, { kind: 'stair', id: 'stair' }, { move: { x: 20, z: 0 } }).issue,
  ).toBeTruthy()
  const movedFloor = transformElement(
    original,
    { kind: 'slab', id: upper.slabs[0].id },
    { move: { x: 0.2, z: 0.2 } },
  )
  expect(movedFloor.issue).toBeNull()
  expect(movedFloor.project.buildings[0].levels[1].slabs![0].openings[0].polygon).toEqual(
    upper.slabs[0].openings[0].polygon,
  )
  upper.locked = true
  expect(
    transformElement(original, { kind: 'stair', id: 'stair' }, { move: { x: 0.1, z: 0 } }).issue,
  ).toContain('Unlock')
})
test('drag previews make one undo step and Escape restores the full original project', () => {
  useProject.getState().setProject(project())
  const original = useProject.getState().project!
  for (const x of [0.1, 0.2, 0.3])
    useProject
      .getState()
      .preview(transformElement(original, { kind: 'column', id: 'column' }, { move: { x, z: 0 } }).project)
  expect(useProject.getState().history).toHaveLength(0)
  expect(useProject.getState().version).toBe(0)
  useProject.getState().finishPreview()
  expect(useProject.getState().history).toHaveLength(1)
  useProject.getState().undo()
  expect(useProject.getState().project!.buildings[0].levels[0].columns![0].position.x).toBe(3)
  useProject.getState().redo()
  const saved = useProject.getState().project!
  useProject
    .getState()
    .preview(transformElement(saved, { kind: 'column', id: 'column' }, { move: { x: 1, z: 0 } }).project)
  useProject.getState().cancelPreview()
  expect(useProject.getState().project).toBe(saved)
  expect(useProject.getState().history).toHaveLength(1)
})
test('keyboard fine movement and editing shortcuts preserve browser/workspace modifier shortcuts', () => {
  const event = { key: 'ArrowRight', shiftKey: false, ctrlKey: false, metaKey: false, altKey: false }
  expect(editingKey(event)).toEqual({ move: { x: 0.1, z: 0 } })
  expect(editingKey({ ...event, shiftKey: true })).toEqual({ move: { x: 0.01, z: 0 } })
  expect(editingKey({ ...event, ctrlKey: true })).toBeNull()
  expect(editingKey({ ...event, key: ']' })).toEqual({ rotate: 5 })
  expect(editingKey({ ...event, key: 'PageUp' })).toEqual({ height: 0.1 })
  expect(selectedElement(project().buildings[0], { kind: 'column', id: 'column' })?.points).toEqual([
    { x: 3, z: 2 },
  ])
})
