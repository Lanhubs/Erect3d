import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { fixtureProject } from '../src/domain/fixture'
import { blankLevel, duplicateLevel, normalizeProject, translateLevel } from '../src/domain/levels'
import { newVeranda, verandaCover, verandaGeometry } from '../src/geometry/veranda'
import { defaultRoof, type Point, type Roof } from '../src/domain/types'
import { roofLayout } from '../src/geometry/roof'
import { roofClosurePanels, roofHeightAt } from '../src/geometry/roofClosure'
import { clipRoofLayout } from '../src/geometry/roofFootprint'
import { effectiveRoofSections } from '../src/domain/roofCoverage'
import { rebuildImportedRoof } from '../src/domain/roofDesign'
import { polygonArea, buildingQuantities } from '../src/geometry/quantities'
import { VerandaControls } from '../src/features/inspector/VerandaControls'
import { transformElement } from '../src/domain/elementEditing'

const rect = (x: number, z: number, w: number, d: number): Point[] => [
  { x, z },
  { x: x + w, z },
  { x: x + w, z: z + d },
  { x, z: z + d },
]

test('imported plans do not render a generated roof over stale footprints before walls are erected; manual canopy roofs remain', () => {
  const building = fixtureProject().buildings[0],
    level = building.levels[0]
  level.sourceId = 'new-source'
  level.walls = []
  level.columns = []
  level.rooms = [{ id: 'stale-room', name: 'Old room', material: 'tile', polygon: rect(0, 0, 8, 8) }]
  rebuildImportedRoof(building, level)
  expect(effectiveRoofSections(building)).toHaveLength(0)
  building.roofSections!.push({
    id: 'canopy',
    name: 'Manual canopy',
    levelId: level.id,
    footprint: rect(0, 0, 2, 2),
    automatic: false,
    roof: defaultRoof,
  })
  expect(effectiveRoofSections(building).map((item) => item.id)).toEqual(['canopy'])
})
test('upper-floor door veranda is outside its room, level with the threshold, and guarded on three exposed edges', () => {
  const project = fixtureProject(),
    level = project.buildings[0].levels[0]
  level.elevation = 3
  const wall = level.walls.find((item) => item.id === level.doors[0].wallId)!,
    door = level.doors[0]
  door.veranda = newVeranda(level, door)
  const geometry = verandaGeometry(level, door)!
  expect(geometry.slab.elevation).toBe(0)
  expect(door.veranda.railing).toBe(true)
  expect(geometry.rails).toHaveLength(3)
  expect(geometry.width).toBeGreaterThan(door.width)
  expect(polygonArea(geometry.polygon)).toBeCloseTo(geometry.width * geometry.depth)
  const tangentX = wall.end.x - wall.start.x,
    tangentZ = wall.end.z - wall.start.z
  expect(Math.abs(geometry.outward.x * tangentX + geometry.outward.z * tangentZ)).toBeLessThan(1e-6)
  const before = geometry.anchor
  const moved = transformElement(
    project,
    { kind: 'door', id: door.id },
    {
      move: {
        x: (tangentX / Math.hypot(tangentX, tangentZ)) * 0.1,
        z: (tangentZ / Math.hypot(tangentX, tangentZ)) * 0.1,
      },
    },
  )
  expect(moved.issue).toBeNull()
  const after = verandaGeometry(
    moved.project.buildings[0].levels[0],
    moved.project.buildings[0].levels[0].doors[0],
  )!
  expect(Math.hypot(after.anchor.x - before.x, after.anchor.z - before.z)).toBeCloseTo(0.1)
  const markup = renderToStaticMarkup(<VerandaControls level={level} door={door} unit="m" />)
  expect(markup).toContain('upper floor')
  expect(markup).toContain('Projection')
  expect(markup).toContain('Cover design')
})
test('verandas persist, duplicate independently and follow floor alignment', () => {
  const project = fixtureProject(),
    ground = project.buildings[0].levels[0],
    door = ground.doors[0]
  door.veranda = newVeranda(ground, door)
  const upper = duplicateLevel(ground, 'Upper', 3)
  upper.doors[0].veranda!.depth = 2
  expect(door.veranda.depth).toBe(1.5)
  const before = verandaGeometry(upper, upper.doors[0])!
  translateLevel(upper, { x: 3, z: 4 })
  const after = verandaGeometry(upper, upper.doors[0])!
  expect(after.anchor.x).toBeCloseTo(before.anchor.x + 3)
  expect(after.anchor.z).toBeCloseTo(before.anchor.z + 4)
  project.buildings[0].levels.push(upper)
  const restored = normalizeProject(JSON.parse(JSON.stringify(project)))
  expect(restored.buildings[0].levels[1].doors[0].veranda!.depth).toBe(2)
})
test('slab and roof quantities include a veranda without creating an extra room', () => {
  const project = fixtureProject(),
    level = project.buildings[0].levels[0],
    before = buildingQuantities(project.buildings[0])
  level.doors[0].veranda = newVeranda(level, level.doors[0])
  const after = buildingQuantities(project.buildings[0]),
    geometry = verandaGeometry(level, level.doors[0])!
  expect(after.slabArea - before.slabArea).toBeCloseTo(geometry.width * geometry.depth)
  expect(after.roofArea).toBeGreaterThan(before.roofArea)
  expect(after.rooms).toBe(before.rooms)
  const cover = verandaCover(level, level.doors[0])!
  expect(cover.roof.material).toBe((level.roof || defaultRoof).material)
  level.doors[0].veranda!.roofShape = 'terrace'
  expect(verandaCover(level, level.doors[0])!.roof.material).toBe('concrete')
})
test('all roof styles close at concave wall and courtyard boundaries along the actual surface', () => {
  const outer = [
    { x: 0, z: 0 },
    { x: 8, z: 0 },
    { x: 8, z: 3 },
    { x: 5, z: 3 },
    { x: 5, z: 8 },
    { x: 0, z: 8 },
  ]
  const hole = rect(1, 2, 1, 2)
  for (const shape of [
    'gable',
    'hip',
    'shed',
    'mansard',
    'butterfly',
    'terrace',
    'hidden',
    'cross-gable',
    'cross-hip',
  ] as Roof['shape'][]) {
    const layout = clipRoofLayout(
      roofLayout({ minX: 0, maxX: 8, minZ: 0, maxZ: 8, top: 3 }, { ...defaultRoof, shape }),
      outer,
      [hole],
    )
    const panels = roofClosurePanels([outer, hole], layout.faces, 3)
    expect(panels.length).toBeGreaterThan(0)
    expect(panels.some((face) => face.some(([x, , z]) => x === 5 && z > 3))).toBe(true)
    expect(panels.some((face) => face.some(([x, , z]) => x === 1 && z >= 2 && z <= 4))).toBe(true)
    for (const face of panels)
      for (const [x, y, z] of face.slice(2)) {
        expect(y).toBeCloseTo(Math.max(3, roofHeightAt(layout.faces, { x, z })! - 0.04), 4)
      }
  }
})
test('new storeys receive a roof and covered lower roof portions disappear while exposed wings remain', () => {
  const project = fixtureProject(),
    building = project.buildings[0],
    ground = building.levels[0]
  ground.rooms = [{ id: 'ground', name: 'Ground', material: 'tile', polygon: rect(0, 0, 8, 8) }]
  ground.autoRoof = false
  rebuildImportedRoof(building, ground)
  const upper = duplicateLevel(ground, 'Upper', 3)
  upper.rooms[0].polygon = rect(4, 0, 4, 8)
  upper.slabs = []
  building.levels.push(upper)
  const sections = effectiveRoofSections(building)
  expect(sections.filter((section) => section.levelId === upper.id)).toHaveLength(1)
  expect(sections.filter((section) => section.levelId === ground.id)).toHaveLength(1)
  expect(polygonArea(sections.find((section) => section.levelId === ground.id)!.footprint)).toBeCloseTo(32)
  expect(
    sections.every((section) => section.roof.shape === (building.roof || ground.roof || defaultRoof).shape),
  ).toBe(true)
  const fullUpper = blankLevel('Full upper', 6, 3)
  fullUpper.rooms = [{ id: 'full', name: 'Full upper', material: 'tile', polygon: rect(0, 0, 8, 8) }]
  building.levels.push(fullUpper)
  expect(effectiveRoofSections(building).filter((section) => section.automatic)).toHaveLength(1)
})
