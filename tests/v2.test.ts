import { expect, test } from 'bun:test'
import { fixtureProject } from '../src/domain/fixture'
import { blankLevel, duplicateLevel, normalizeProject, refreshAutoSlabs, translateLevel, translateWalls } from '../src/domain/levels'
import { atriumBuilding, stairBuilding, threeStoreyBuilding, twoStoreyHouse } from '../src/domain/v2Fixtures'
import { buildingQuantities, slabArea } from '../src/geometry/quantities'
import { localToWorld, stairHeightAt, stairLanding, stairOpening, stairSteps } from '../src/geometry/stairs'
import { containsPolygon } from '../src/geometry/polygons'
import { useProject } from '../src/state/project'
import { defaultRoof } from '../src/domain/types'
import { roomArea } from '../src/geometry/math'
import { roomShapes } from '../src/rendering/roomShape'
import { findStairPlacement } from '../src/geometry/stairPlacement'
import { connectAdjacentLevels, normalizeProject } from '../src/domain/levels'

test('V1 data migrates to one level while preserving wall IDs and roof settings', () => {
  const original = fixtureProject(), level = original.buildings[0].levels[0]
  const migrated = normalizeProject(original)
  expect(migrated.buildings[0].levels).toHaveLength(1)
  expect(migrated.buildings[0].levels[0].walls.map(wall => wall.id)).toEqual(level.walls.map(wall => wall.id))
  expect(migrated.buildings[0].roof).toEqual(level.roof!)
  expect(migrated.buildings[0].levels[0].slabs).toHaveLength(1)
})

test('duplicated floors have independent identities and maintain hosted openings', () => {
  const ground = twoStoreyHouse().buildings[0].levels[0]
  const upper = duplicateLevel(ground, 'Test', 4)
  expect(upper.walls[0].id).not.toBe(ground.walls[0].id)
  expect(upper.doors[0].wallId).toBe(upper.walls[2].id)
  upper.walls[0].start.x = 9
  expect(ground.walls[0].start.x).toBe(0)
})

test('multi-level quantities count floors and only the top roof', () => {
  const two = buildingQuantities(twoStoreyHouse().buildings[0])
  const three = buildingQuantities(threeStoreyBuilding().buildings[0])
  expect(two.byLevel).toHaveLength(2)
  expect(two.floorArea).toBeCloseTo(192)
  expect(two.roofArea).toBeCloseTo(two.byLevel[1].quantities.roofArea)
  expect(three.byLevel).toHaveLength(3)
  expect(three.slabArea).toBeGreaterThan(two.slabArea)
})

test('atrium void removes actual floor area', () => {
  const building = atriumBuilding().buildings[0]
  const slab = building.levels[1].slabs![0]
  expect(slabArea(slab)).toBeCloseTo(88)
  expect(buildingQuantities(building).slabArea).toBeCloseTo(184)
})

test('stair links levels and its opening is contained in upper slab', () => {
  const building = stairBuilding().buildings[0], [ground, upper] = building.levels
  const stair = ground.stairs![0], steps = stairSteps(stair, building.levels)
  expect(steps.length).toBeGreaterThan(10)
  expect(steps.at(-1)!.height).toBeCloseTo(upper.elevation - ground.elevation)
  expect(containsPolygon(upper.slabs![0].polygon, upper.slabs![0].openings[0].polygon)).toBe(true)
  expect(stairHeightAt(stair, building.levels, { x: stair.start.x + .14, z: stair.start.z })).not.toBeNull()
})

test('adding a level and editing its slab are undoable as whole-project changes', () => {
  const project = twoStoreyHouse(), store = useProject.getState()
  store.setProject(project)
  store.editProject(copy => { copy.buildings[0].levels[1].slabs![0].thickness = .3; return copy })
  expect(useProject.getState().project!.buildings[0].levels[1].slabs![0].thickness).toBe(.3)
  useProject.getState().undo()
  expect(useProject.getState().project!.buildings[0].levels[1].slabs![0].thickness).toBe(.22)
  useProject.getState().redo()
  expect(useProject.getState().project!.buildings[0].levels[1].slabs![0].thickness).toBe(.3)
})

test('level alignment moves editable geometry and imported draft walls together', () => {
  const level = atriumBuilding().buildings[0].levels[1]
  const firstWall = level.walls[0].start.x, firstSlab = level.slabs![0].polygon[0].x
  const opening = level.slabs![0].openings[0].polygon[0].x
  translateLevel(level, { x: 1.5, z: -2 })
  expect(level.walls[0].start.x).toBeCloseTo(firstWall + 1.5)
  expect(level.slabs![0].polygon[0].x).toBeCloseTo(firstSlab + 1.5)
  expect(level.slabs![0].openings[0].polygon[0].x).toBeCloseTo(opening + 1.5)
  const draft = { walls: structuredClone(level.walls.slice(0, 1)) }
  translateWalls(draft, { x: -.5, z: 0 })
  expect(draft.walls[0].start.x).toBeCloseTo(firstWall + 1)
})

test('editing the top roof also updates the building roof used by 3D', () => {
  const project = twoStoreyHouse(), upper = project.buildings[0].levels[1]
  useProject.getState().setProject(project)
  useProject.getState().setActiveLevel(upper.id)
  useProject.getState().edit(model => ({ ...model, roof: { ...defaultRoof, shape: 'gable' } }))
  expect(useProject.getState().project!.buildings[0].roof?.shape).toBe('gable')
  useProject.getState().undo()
  expect(useProject.getState().project!.buildings[0].roof?.shape).toBe('hip')
})

test('an upper-floor import is not assigned to Ground during migration', () => {
  const project = twoStoreyHouse(), upper = project.buildings[0].levels[1]
  upper.sourceId = 'upper-plan'
  project.sources = [{ id: 'upper-plan', name: 'First.png', mime: 'image/png', width: 1000, height: 800, originalBytes: 4000 }]
  const normalized = normalizeProject(project)
  expect(normalized.buildings[0].levels[0].sourceId).toBeUndefined()
  expect(normalized.buildings[0].levels[1].sourceId).toBe('upper-plan')
})

test('straight, L and U stairs climb the same real floor rise', () => {
  const building = stairBuilding().buildings[0], stair = building.levels[0].stairs![0]
  for (const form of ['straight', 'L', 'U'] as const) {
    const current = { ...stair, form }, steps = stairSteps(current, building.levels)
    expect(steps.at(-1)!.height).toBeCloseTo(building.levels[1].elevation)
    expect(steps.every((step, index) => index === 0 || step.height - steps[index - 1].height <= .2)).toBe(true)
    const landing = stairLanding(current, building.levels)
    if (landing) expect(stairHeightAt(current, building.levels, localToWorld(current, landing.u, landing.v))).not.toBeNull()
    expect(containsPolygon(building.levels[1].slabs![0].polygon, stairOpening(current, building.levels))).toBe(true)
  }
})

test('atrium opening cuts the room finish surface above it', () => {
  const upper = atriumBuilding().buildings[0].levels[1]
  const voidPolygon = upper.slabs![0].openings[0].polygon
  const pieces = roomShapes(upper.rooms[0], [voidPolygon])
  expect(pieces).toHaveLength(4)
  expect(pieces.reduce((sum, shape) => sum + Math.abs(shape.getPoints().reduce((area, point, index, points) =>
    area + point.x * points[(index + 1) % points.length].y - points[(index + 1) % points.length].x * point.y, 0)) / 2, 0)).toBeCloseTo(32)
  expect(roomShapes(upper.rooms[1], [voidPolygon])).toHaveLength(1)
})

test('manual walls create an editable slab that follows later wall extents', () => {
  const level = blankLevel('New floor', 3, 3.4)
  level.walls = structuredClone(twoStoreyHouse().buildings[0].levels[0].walls.slice(0, 2))
  refreshAutoSlabs(level)
  expect(level.slabs).toHaveLength(1)
  expect(level.slabs![0].autoFromWalls).toBe(true)
  level.walls[0].end.x = 14
  refreshAutoSlabs(level)
  expect(level.slabs![0].polygon[1].x).toBe(14)
})

test('stair opening cuts floor finish across adjacent rooms', () => {
  const upper = stairBuilding().buildings[0].levels[1]
  const opening = upper.slabs![0].openings[0].polygon
  for (const room of upper.rooms.slice(0, 2)) {
    const pieces = roomShapes(room, [opening])
    const area = pieces.reduce((sum, shape) => sum + Math.abs(shape.getPoints().reduce((total, point, index, points) =>
      total + point.x * points[(index + 1) % points.length].y - points[(index + 1) % points.length].x * point.y, 0)) / 2, 0)
    expect(area).toBeLessThan(roomArea(room))
  }
})

test('new stairs find a clear route and fit an opening inside the upper slab', () => {
  const building = twoStoreyHouse().buildings[0]
  const sample = stairBuilding().buildings[0].levels[0].stairs![0]
  const stair = findStairPlacement({ ...sample, fromLevelId: building.levels[0].id,
    toLevelId: building.levels[1].id }, building.levels, building.levels[1].slabs!)
  expect(stair).not.toBeNull()
  expect(stair!.direction).toBe(90)
  expect(containsPolygon(building.levels[1].slabs![0].polygon, stairOpening(stair!, building.levels))).toBe(true)
})

test('adding a storey connects adjacent levels with a stair when a route fits', () => {
  const project = normalizeProject(twoStoreyHouse())
  const [ground, upper] = project.buildings[0].levels
  expect(ground.stairs).toHaveLength(1)
  expect(ground.stairs![0].toLevelId).toBe(upper.id)
  expect(upper.slabs![0].openings.some(opening => opening.id === ground.stairs![0].openingId)).toBe(true)
})

test('normalizing an existing stair restores a missing upper-floor opening', () => {
  const project = stairBuilding(), [ground, upper] = project.buildings[0].levels
  upper.slabs![0].openings = []
  const normalized = normalizeProject(project), [normalizedGround, normalizedUpper] = normalized.buildings[0].levels
  expect(normalizedGround.stairs).toHaveLength(1)
  expect(normalizedUpper.slabs![0].openings).toHaveLength(1)
  expect(normalizedUpper.slabs![0].openings[0].id).toBe(normalizedGround.stairs![0].openingId)
})

test('duplicating a floor leaves orphaned stair openings behind', () => {
  const building = stairBuilding().buildings[0]
  const duplicate = duplicateLevel(building.levels[1], 'Level 02', 6.4)
  expect(duplicate.slabs![0].openings.some(opening => opening.kind === 'stair')).toBe(false)
})
