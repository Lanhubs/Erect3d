import { beforeAll, expect, test } from 'bun:test'
import { analyzePlan, type PlanAnalysisResult } from '../src/workers/analyze'
import { worldInterpretation } from '../src/geometry/planInterpretation'
import { findOpeningCandidates } from '../src/geometry/openingCandidates'
import { acceptInterpretation } from '../src/domain/acceptInterpretation'
import { fixtureProject } from '../src/domain/fixture'
import { containsPoint } from '../src/geometry/polygons'
import { clipRoofLayout, footprintTriangles } from '../src/geometry/roofFootprint'
import { roofLayout } from '../src/geometry/roof'
import { signedPlanArea } from '../src/geometry/roomTopology'
import { roofOverhang } from '../src/geometry/roofOverhang'

let result: PlanAnalysisResult
beforeAll(async () => {
  const pixels = new Uint8ClampedArray(await Bun.file('tests/fixtures/complex-courtyard-plan.rgba').arrayBuffer())
  result = await analyzePlan(pixels, 577, 556)
})

test('the complete complex-plan pipeline preserves its rooms and empty courtyard', () => {
  const world = worldInterpretation(result, { width: 577, height: 556 }), project = fixtureProject()
  const level = project.buildings[0].levels[0], scale = world.calibration.metresPerPixel
  Object.assign(level, { walls: [], doors: [], windows: [], rooms: [], slabs: [], autoSlab: true })
  const openings = findOpeningCandidates(world.walls, world.features)
  acceptInterpretation(project, level.id, world.walls, openings, world.details.filter(detail => detail.kind === 'stair'), false)
  expect(level.walls.length).toBeGreaterThan(30)
  expect(level.doors.length).toBeGreaterThanOrEqual(5)
  // The long single stroke beside the left wing was previously counted repeatedly as glazing.
  const annotationGap = openings.find(item => Math.abs(item.start.x / scale - 184) < 1 && Math.abs(item.start.z / scale - 355) < 1)
  expect(annotationGap).toBeDefined()
  expect(annotationGap!.choice).toBe('unknown')
  expect(level.rooms.length).toBeGreaterThan(10)
  for (const [x, z] of [[160, 80], [250, 410], [355, 400], [450, 425]])
    expect(level.rooms.some(room => containsPoint(room.polygon, { x: x * scale, z: z * scale }))).toBe(true)
  for (const [x, z] of [[335, 230], [270, 15], [540, 300]]) {
    const outside = { x: x * scale, z: z * scale }
    expect(level.rooms.some(room => containsPoint(room.polygon, outside))).toBe(false)
    expect(level.slabs!.some(slab => containsPoint(slab.polygon, outside))).toBe(false)
    expect(project.buildings[0].roofSections!.some(roof => containsPoint(roof.footprint, outside) && !roof.voids?.some(hole => containsPoint(hole, outside)))).toBe(false)
  }
  expect(level.stairGuides!.length).toBeGreaterThan(0)
  expect(level.columns).toHaveLength(0)
  expect(result.report.smallRaster).toBe(true)
  expect(level.autoSlab).toBe(false)
  for (const section of project.buildings[0].roofSections!) {
    const xs = section.footprint.map(p => p.x), zs = section.footprint.map(p => p.z)
    const bounds = { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs), top: 3 }
    const layout = clipRoofLayout(roofLayout(bounds, section.roof), section.footprint, section.voids)
    const area = layout.faces.reduce((sum, face) => sum + Math.abs(signedPlanArea(face.map(([x, , z]) => ({ x, z })))), 0)
    expect(area).toBeCloseTo(signedPlanArea(section.footprint) - (section.voids || []).reduce((sum, hole) => sum + Math.abs(signedPlanArea(hole)), 0), 4)
    expect(section.followFootprint).toBe(true)
  }
})

test('manual calibration is preserved and automatic scale does not need picked points', () => {
  const automatic = worldInterpretation(result, { width: 577, height: 556 })
  expect(automatic.calibration.method).toBe('auto')
  expect(automatic.calibration.basis).toBe('door-symbols')
  const manual = { a: { x: 12, z: 24 }, b: { x: 112, z: 24 }, knownMetres: 5, metresPerPixel: .05, method: 'manual' as const }
  expect(worldInterpretation(result, { width: 577, height: 556 }, manual).calibration).toEqual(manual)
})

test('the actual upgraded worker still excludes the simple source plan margin', async () => {
  const pixels = new Uint8ClampedArray(await Bun.file('tests/fixtures/white-margin-floor-plan.rgba').arrayBuffer())
  const data = await analyzePlan(pixels, 432, 378), world = worldInterpretation(data, { width: 432, height: 378 })
  const project = fixtureProject(), level = project.buildings[0].levels[0]
  acceptInterpretation(project, level.id, world.walls, findOpeningCandidates(world.walls, world.features), [], true)
  expect(Math.min(...data.candidates.flatMap(wall => [wall.y1, wall.y2]))).toBeGreaterThanOrEqual(65)
  expect(level.doors.length).toBeGreaterThanOrEqual(4)
  expect(level.rooms.some(room => containsPoint(room.polygon, { x: 100 * world.calibration.metresPerPixel, z: 25 * world.calibration.metresPerPixel }))).toBe(false)
})

test('a concave roof retains a courtyard cutout across every supported roof form', () => {
  const footprint = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }, { x: 7, z: 10 },
    { x: 7, z: 3 }, { x: 3, z: 3 }, { x: 3, z: 10 }, { x: 0, z: 10 }]
  expect(footprintTriangles(footprint).reduce((sum, triangle) => sum + signedPlanArea(triangle), 0)).toBeCloseTo(72)
  const expanded = roofOverhang(footprint, .4)
  expect(signedPlanArea(expanded)).toBeGreaterThan(72)
  expect(containsPoint(expanded, { x: 5, z: 6 })).toBe(false)
  expect(containsPoint(expanded, { x: -.2, z: 5 })).toBe(true)
  for (const shape of ['hip', 'gable', 'shed', 'hidden', 'terrace', 'cross-gable', 'cross-hip'] as const) {
    const roof = { shape, material: 'concrete' as const, color: '#888', pitch: 20, overhang: 0 }
    const layout = clipRoofLayout(roofLayout({ minX: 0, maxX: 10, minZ: 0, maxZ: 10, top: 3 }, roof), footprint)
    expect(layout.faces.reduce((sum, face) => sum + Math.abs(signedPlanArea(face.map(([x, , z]) => ({ x, z })))), 0)).toBeCloseTo(72)
    expect(layout.faces.some(face => containsPoint(face.map(([x, , z]) => ({ x, z })), { x: 5, z: 6 }))).toBe(false)
  }
})
