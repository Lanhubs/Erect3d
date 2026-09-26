import { expect, test } from 'bun:test'
import { fixtureProject } from '../src/domain/fixture'
import { levelQuantities } from '../src/geometry/quantities'

test('analysis quantities come from model rooms, walls, openings, and roof geometry', () => {
  const level = fixtureProject().buildings[0].levels[0]
  const quantities = levelQuantities(level)
  expect(quantities.floorArea).toBeCloseTo(96)
  expect(quantities.rooms).toBe(4)
  expect(quantities.doors).toBe(level.doors.length)
  expect(quantities.wallFinishArea).toBeGreaterThan(0)
  expect(quantities.roofArea).toBeGreaterThan(quantities.floorArea)
  expect(quantities.floorByMaterial.reduce((sum, item) => sum + item.area, 0)).toBeCloseTo(96)
})
