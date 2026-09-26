import { expect, test } from 'bun:test'
import type { Wall } from '../src/domain/types'
import { constrainPoint } from '../src/geometry/snapping'

const wall: Wall = { id: 'w', start: { x: 0, z: 0 }, end: { x: 4, z: 0 }, thickness: .2, height: 3, material: 'plaster' }
const settings = { visible: true, snap: true, step: .5, angle: 0, length: 0 }

test('grid snapping quantizes free points but endpoint and midpoint anchors take priority', () => {
  expect(constrainPoint({ x: 2.23, z: 1.26 }, [wall], .1, settings)).toEqual({ x: 2, z: 1.5 })
  expect(constrainPoint({ x: 2.04, z: .03 }, [wall], .1, settings)).toEqual({ x: 2, z: 0 })
  expect(constrainPoint({ x: 4.04, z: .03 }, [wall], .1, settings)).toEqual(wall.end)
})

test('angle and fixed length constrain a new wall endpoint in model metres', () => {
  const result = constrainPoint({ x: 2.4, z: 1.9 }, [], .1,
    { ...settings, snap: false, angle: 45, length: 3 }, { x: 0, z: 0 })
  expect(Math.hypot(result.x, result.z)).toBeCloseTo(3)
  expect(Math.atan2(result.z, result.x) * 180 / Math.PI).toBeCloseTo(45)
})
