import { expect, test } from 'bun:test'
import { ShapeGeometry } from 'three'
import { blankLevel, newSlab } from '../src/domain/levels'
import { ceilingPlan, uncoveredSpace } from '../src/geometry/ceilings'
import { roomShapes } from '../src/rendering/roomShape'
import type { Point, Room } from '../src/domain/types'

const rect = (x: number, z: number, w: number, h: number): Point[] => [
  { x, z },
  { x: x + w, z },
  { x: x + w, z: z + h },
  { x, z: z + h },
]
const room: Room = { id: 'lounge', name: 'Lounge', material: 'timber', polygon: rect(0, 0, 6, 6) }
function area(openings: Point[][]) {
  const geometry = new ShapeGeometry(roomShapes(room, openings)),
    p = geometry.getAttribute('position'),
    idx = geometry.index!
  let total = 0
  for (let i = 0; i < idx.count; i += 3) {
    const a = idx.getX(i),
      b = idx.getX(i + 1),
      c = idx.getX(i + 2)
    total +=
      Math.abs(
        (p.getX(b) - p.getX(a)) * (p.getY(c) - p.getY(a)) - (p.getY(b) - p.getY(a)) * (p.getX(c) - p.getX(a)),
      ) / 2
  }
  geometry.dispose()
  return total
}
test('rotated stair/shaft openings remove only their actual polygon area', () => {
  expect(
    area([
      [
        { x: 3, z: 2 },
        { x: 4, z: 3 },
        { x: 3, z: 4 },
        { x: 2, z: 3 },
      ],
    ]),
  ).toBeCloseTo(34, 5)
  expect(area([rect(2, 2, 1, 2), rect(4, 1, 1, 1)])).toBeCloseTo(33, 5)
})
test('edge openings and concave cutouts preserve the remaining floor', () => {
  expect(area([rect(-1, 2, 2, 2)])).toBeCloseTo(34, 5)
  expect(
    area([
      [
        { x: 1, z: 1 },
        { x: 3, z: 1 },
        { x: 3, z: 2 },
        { x: 2, z: 2 },
        { x: 2, z: 3 },
        { x: 1, z: 3 },
      ],
    ]),
  ).toBeCloseTo(33, 5)
})
test('ceilings meet wall tops and the underside of the actual upper slab', () => {
  const lower = blankLevel('Ground', 0, 3.4),
    upper = blankLevel('First', 3.4, 3.4)
  lower.rooms = [room]
  lower.walls = room.polygon.map((start, i) => ({
    id: `wall${i}`,
    start,
    end: room.polygon[(i + 1) % 4],
    height: 3.4,
    thickness: 0.2,
    material: 'plaster',
  }))
  upper.slabThickness = 0.25
  upper.slabs = [newSlab(room.polygon, 0.25)]
  const plan = ceilingPlan(lower, [lower, upper])
  expect(plan[0].height).toBeCloseTo(3.15)
  expect(ceilingPlan(lower, [lower])[0].height).toBeCloseTo(3.4)
  lower.rooms = [{ ...room, ceilingHeight: 3 }]
  expect(ceilingPlan(lower, [lower, upper])[0].height).toBe(3)
})
test('outdoor rooms and open-to-below spaces stay open; covered porches retain ceilings', () => {
  for (const name of [
    'Open balcony',
    'Uncovered patio',
    'Pool deck',
    'Formal living room (open to below)',
    'Courtyard',
  ])
    expect(uncoveredSpace({ name })).toBe(true)
  for (const name of ['Covered porch', 'Cov’d porch', 'Screened porch', 'Living room'])
    expect(uncoveredSpace({ name })).toBe(false)
})
test('no-room fallback follows actual enclosures, never the rectangular building bounds', () => {
  const level = blankLevel('Ground', 0, 3),
    polygon = [
      { x: 0, z: 0 },
      { x: 6, z: 0 },
      { x: 6, z: 3 },
      { x: 3, z: 3 },
      { x: 3, z: 6 },
      { x: 0, z: 6 },
    ]
  level.walls = polygon.map((start, i) => ({
    id: `wall${i}`,
    start,
    end: polygon[(i + 1) % polygon.length],
    height: 3,
    thickness: 0.2,
    material: 'plaster',
  }))
  const plan = ceilingPlan(level, [level])
  expect(plan).toHaveLength(1)
  expect(plan[0].room.polygon).toHaveLength(6)
})
