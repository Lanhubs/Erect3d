import { expect, test } from 'bun:test'
import { fixtureProject } from '../src/domain/fixture'
import { generateSiteFence, groundFootprint, insertBoundaryPoint, siteBounds, updateFenceBoundary } from '../src/geometry/site'

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