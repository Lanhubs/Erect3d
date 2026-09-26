import { expect, test } from 'bun:test'
import type { Door, Wall, WindowUnit } from '../src/domain/types'
import { resizeWall, rotateWall, splitPosition, splitWall, wallAngle } from '../src/geometry/editWall'
import { wallLength } from '../src/geometry/math'
import { buildColliders, collidesPrepared } from '../src/geometry/walls'

const wall: Wall = { id: 'w1', start: { x: 2, z: 3 }, end: { x: 6, z: 3 }, thickness: .2, height: 3, material: 'plaster' }

test('numeric length and angle update wall geometry from its start point', () => {
  const longer = resizeWall(wall, 5)
  expect(longer.start).toEqual(wall.start)
  expect(longer.end).toEqual({ x: 7, z: 3 })
  const turned = rotateWall(longer, 90)
  expect(wallLength(turned)).toBeCloseTo(5)
  expect(wallAngle(turned)).toBeCloseTo(90)
  expect(turned.end.z).toBeCloseTo(8)
})

test('splitting preserves opening world positions and host references', () => {
  const doors: Door[] = [{ id: 'd1', wallId: 'w1', offset: 2.7, width: .6, height: 2.1, hinge: 'left' }]
  const windows: WindowUnit[] = [{ id: 'n1', wallId: 'w1', offset: .5, width: .6, height: 1, sill: .9 }]
  expect(splitPosition(wall, doors, windows)).toBeCloseTo(2)
  const result = splitWall([wall], doors, windows, wall.id)
  expect(result.walls).toHaveLength(2)
  expect(result.doors[0].wallId).toBe(result.walls[1].id)
  expect(result.doors[0].offset).toBeCloseTo(.7)
  expect(result.windows[0].wallId).toBe(wall.id)
})

test('a closed walk door blocks passage and an open door clears it', () => {
  const door: Door = { id: 'd1', wallId: wall.id, offset: 1.5, width: 1, height: 2.1, hinge: 'left' }
  const point = { x: 4, z: 3 }
  expect(collidesPrepared(point, .22, buildColliders([wall], [door], [], new Set()))).toBe(true)
  expect(collidesPrepared(point, .22, buildColliders([wall], [door], [], new Set(['d1'])))).toBe(false)
})
