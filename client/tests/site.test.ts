import { expect, test } from 'bun:test'
import { fixtureProject } from '../src/domain/fixture'
import { generateSiteFence, groundFootprint, insertBoundaryPoint, siteBounds, updateFenceBoundary, repairGeneratedFence } from '../src/geometry/site'
import { newSlab, normalizeProject } from '../src/domain/levels'
import { containsPoint } from '../src/geometry/polygons'

const rect = (x: number, z: number, w: number, d: number) => [{ x, z }, { x: x + w, z }, { x: x + w, z: z + d }, { x, z: z + d }]

test('automatic site uses ground footprint coordinates and configurable setbacks', () => {
  const project = fixtureProject()
  const ground = project.buildings[0].levels[0]
  const fence = generateSiteFence(ground, { front: 4, rear: 3, left: 2, right: 5 })!
  const footprint = groundFootprint(ground)
  const xs = footprint.map(point => point.x), zs = footprint.map(point => point.z)
  expect(fence.boundary).toEqual([
    { x: Math.min(...xs) - 2, z: Math.min(...zs) - 4 },
    { x: Math.max(...xs) + 5, z: Math.min(...zs) - 4 },
    { x: Math.max(...xs) + 5, z: Math.max(...zs) + 3 },
    { x: Math.min(...xs) - 2, z: Math.max(...zs) + 3 },
  ])
  expect(siteBounds(fence)?.maxX).toBe(Math.max(...xs) + 5)
  expect(fixtureProject().buildings[0].siteFence).toBeUndefined()
  expect(siteBounds({ ...fence, enabled: false })).toBeUndefined()
})

test('editing a boundary point updates segments but preserves gate ownership', () => {
  const ground = fixtureProject().buildings[0].levels[0]
  const fence = generateSiteFence(ground)!
  fence.gates.push({ id: 'gate', kind: 'pedestrian', segmentId: fence.segments[0].id, offset: 1, width: .9, height: 1.1 })
  const boundary = fence.boundary!.map(point => ({ ...point }))
  boundary[1].x += 2
  const updated = updateFenceBoundary(fence, boundary)
  expect(updated.segments[0].end.x).toBe(boundary[1].x)
  expect(updated.gates[0].segmentId).toBe(updated.segments[0].id)
})

test('adding a boundary point bisects the longest segment', () => {
  const boundary = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 8 }, { x: 0, z: 8 }]
  expect(insertBoundaryPoint(boundary)).toEqual([
    { x: 0, z: 0 }, { x: 5, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 8 }, { x: 0, z: 8 },
  ])
})

test('a fence surrounds all imported room slabs and walls beyond the first slab', () => {
  const project = fixtureProject(), ground = project.buildings[0].levels[0]
  ground.slabs = [newSlab(rect(10, 20, 4, 4)), newSlab(rect(14, 20, 8, 8))]
  ground.rooms = []
  ground.walls = [{ id: 'exterior', start: { x: 10, z: 20 }, end: { x: 14, z: 20 }, kind: 'exterior', thickness: .2, height: 3, material: 'plaster' },
    { id: 'outer-unclassified', start: { x: 22, z: 20 }, end: { x: 22, z: 30 }, thickness: .2, height: 3, material: 'plaster' }]
  const fence = generateSiteFence(ground)!
  for (const point of [...ground.slabs.flatMap(slab => slab.polygon), ...ground.walls.flatMap(wall => [wall.start, wall.end])])
    expect(containsPoint(fence.boundary!, point)).toBe(true)
  expect(siteBounds(fence)!.maxZ).toBeCloseTo(33.1)
})

test('legacy fences around just the first slab repair on load while edited boundaries stay manual', () => {
  const project = fixtureProject(), building = project.buildings[0], ground = building.levels[0]
  const original = generateSiteFence(ground)!
  ground.slabs = [newSlab(rect(0, 0, 3, 3)), newSlab(rect(3, 0, 10, 8))]
  ground.walls = []; ground.rooms = []
  building.siteFence = { ...original, mode: undefined, boundary: rect(-3, -4, 9, 10),
    segments: original.segments }
  const loaded = normalizeProject(project), repaired = loaded.buildings[0].siteFence!
  expect(repaired.mode).toBe('automatic')
  expect(siteBounds(repaired)!.maxX).toBe(16)
  const manual = updateFenceBoundary(repaired, rect(-5, -5, 30, 25))
  loaded.buildings[0].siteFence = manual
  repairGeneratedFence(loaded.buildings[0])
  expect(loaded.buildings[0].siteFence).toEqual(manual)
})

test('adding a boundary point keeps a gate on the same physical stretch of fence', () => {
  const ground = fixtureProject().buildings[0].levels[0], fence = generateSiteFence(ground)!
  const boundary = rect(0, 0, 20, 8)
  const current = updateFenceBoundary(fence, boundary)
  current.gates = [{ id: 'gate', kind: 'pedestrian', segmentId: current.segments[0].id, offset: 14, width: 1, height: 1.2 }]
  const changed = updateFenceBoundary(current, insertBoundaryPoint(boundary))
  const gate = changed.gates[0], host = changed.segments.find(segment => segment.id === gate.segmentId)!
  expect(host.start).toEqual({ x: 10, z: 0 })
  expect(gate.offset).toBe(4)
  expect(gate.width).toBe(1)
})
