import { expect, test } from 'bun:test'
import type { Level } from '../src/domain/types'
import { validateOpening } from '../src/geometry/openingValidation'

const level: Level = { id: 'l', name: 'Ground', elevation: 0, slabThickness: .2, rooms: [], passages: [],
  walls: [{ id: 'w', start: { x: 0, z: 0 }, end: { x: 5, z: 0 }, thickness: .2, height: 2.9, material: 'plaster' }],
  doors: [{ id: 'd', wallId: 'w', offset: 1, width: .9, height: 2.1, hinge: 'left' }], windows: [] }

test('hosted openings stay within the wall and do not overlap', () => {
  expect(validateOpening(level, { id: 'next', wallId: 'w', offset: 1.5, width: 1, height: 1, sill: .9 })).toContain('overlaps')
  expect(validateOpening(level, { id: 'next', wallId: 'w', offset: 4.7, width: 1, height: 1, sill: .9 })).toContain('fit inside')
  expect(validateOpening(level, { id: 'next', wallId: 'w', offset: 2.5, width: 1, height: 1, sill: -.1 })).toContain('sill')
  expect(validateOpening(level, { id: 'next', wallId: 'w', offset: 2.5, width: 1, height: 1, sill: .9 })).toBeNull()
})
