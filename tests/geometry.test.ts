import { describe, expect, test } from 'bun:test'
import { fixtureProject } from '../src/domain/fixture'
import { levelOf } from '../src/domain/types'
import { atWall, calibrate, nearestPoint, roomArea, roomPerimeter, segmentIntersection, snapWallEnd, sourceToWorld, wallLength } from '../src/geometry/math'
import { collides, siteFenceColliders, wallSolids } from '../src/geometry/walls'
import { generateSiteFence } from '../src/geometry/site'
import { walkStart } from '../src/geometry/walk'
import { formatArea, formatDistance, toMetres } from '../src/geometry/units'

describe('architectural units and openings', () => {
  const level = levelOf(fixtureProject())
  test('keeps wall geometry in metres', () => {
    const north = level.walls[0]
    expect(wallLength(north)).toBe(12)
    expect(atWall(north, 3)).toEqual({ x: 3, z: 0 })
  })
  test('calibrates image pixels to world coordinates', () => {
    const scale = calibrate({ x: 100, z: 50 }, { x: 500, z: 50 }, 4)
    expect(scale.metresPerPixel).toBe(.01)
    expect(sourceToWorld({ x: 300, z: 250 }, scale)).toEqual({ x: 2, z: 2 })
    expect(() => calibrate({ x: 0, z: 0 }, { x: 0, z: 0 }, 4)).toThrow()
  })
  test('computes room area and perimeter', () => {
    expect(roomArea(level.rooms[0])).toBe(40)
    expect(roomPerimeter(level.rooms[0])).toBe(26)
  })
  test('snaps a nearby endpoint without moving distant points', () => {
    expect(nearestPoint({ x: .03, z: .02 }, level.walls, .1)).toEqual({ x: 0, z: 0 })
    expect(nearestPoint({ x: 2, z: 2 }, level.walls, .1)).toEqual({ x: 2, z: 2 })
  })
  test('aligns new wall endpoints horizontally and vertically', () => {
    expect(snapWallEnd({ x: 1, z: 1 }, { x: 4, z: 1.04 }, [], .1)).toEqual({ x: 4, z: 1 })
    expect(snapWallEnd({ x: 1, z: 1 }, { x: 1.04, z: 4 }, [], .1)).toEqual({ x: 1, z: 4 })
  })
  test('finds perpendicular snaps and wall intersections', () => {
    expect(snapWallEnd({ x: 4, z: 4 }, { x: 3, z: .06 }, [level.walls[0]], .1)).toEqual({ x: 3, z: 0 })
    expect(segmentIntersection({ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 2, z: -2 }, { x: 2, z: 2 })).toEqual({ x: 2, z: 0 })
    expect(segmentIntersection({ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 5, z: -2 }, { x: 5, z: 2 })).toBeNull()
  })
  test('converts display units without changing model metres', () => {
    expect(toMetres(450, 'cm')).toBe(4.5)
    expect(formatDistance(2.7, 'mm')).toBe('2700 mm')
    expect(formatArea(4, 'cm')).toBe('40000 cm²')
  })
  test('segments a door gap and leaves it walkable', () => {
    const wall = level.walls[2]
    const solids = wallSolids(wall, level.doors, level.windows)
    expect(solids.some(item => item.start <= 2.1 && item.end >= 3.2 && item.bottom === 0)).toBe(false)
    expect(collides({ x: 9.35, z: 8 }, .2, level.walls, level.doors, level.windows)).toBe(false)
    expect(collides({ x: 6, z: 8 }, .2, level.walls, level.doors, level.windows)).toBe(true)
  })
  test('spawns walkthrough near an entrance without intersecting a wall', () => {
    const start = walkStart(level)
    expect(collides(start.point, .22, level.walls, level.doors, level.windows)).toBe(false)
    expect(start.point.z).toBeGreaterThan(8)
  })
  test('treats the site fence as ground-floor-only perimeter blocking', () => {
    const project = fixtureProject()
    const fence = generateSiteFence(project.buildings[0].levels[0])!
    const front = fence.segments[0]
    expect(siteFenceColliders(fence).length).toBeGreaterThan(0)
    expect(siteFenceColliders({ ...fence, enabled: false })).toHaveLength(0)
    expect(collides({ x: 7, z: 9.3 }, .22, level.walls, level.doors, level.windows, [], fence)).toBe(false)
    expect(collides({ x: (front.start.x + front.end.x) / 2, z: front.start.z }, .22, level.walls, level.doors, level.windows, [], fence)).toBe(true)
  })
})
