import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { fixtureProject } from '../src/domain/fixture'
import { defaultRoof, type Point } from '../src/domain/types'
import { rebuildImportedRoof, setBuildingRoof } from '../src/domain/roofDesign'
import { normalizeProject, translateLevel } from '../src/domain/levels'
import { roofRegions } from '../src/geometry/roofRegions'
import { roofLayout } from '../src/geometry/roof'
import { clipRoofLayout } from '../src/geometry/roofFootprint'
import { signedPlanArea } from '../src/geometry/roomTopology'
import { containsPoint } from '../src/geometry/polygons'
import { RoofControls } from '../src/features/inspector/RoofControls'
import { useProject } from '../src/state/project'
import { generateSiteFence, siteBounds } from '../src/geometry/site'
import { clipRoofEdges } from '../src/geometry/roofEdges'

const rect = (x: number, z: number, w: number, d: number): Point[] => [
  { x, z },
  { x: x + w, z },
  { x: x + w, z: z + d },
  { x, z: z + d },
]
test('adjacent rooms, split edges and nested fixture boxes share one roof outline', () => {
  const regions = roofRegions([rect(0, 0, 4, 8), rect(4, 0, 4, 4), rect(4, 4, 4, 4), rect(1, 1, 1, 1)])
  expect(regions).toHaveLength(1)
  expect(regions[0].voids).toHaveLength(0)
  expect(signedPlanArea(regions[0].footprint)).toBeCloseTo(64)
  expect(regions[0].footprint).toHaveLength(4)
})

test('a continuous courtyard roof has one design and retains its true uncovered opening', () => {
  const regions = roofRegions([rect(0, 0, 8, 2), rect(0, 2, 2, 4), rect(6, 2, 2, 4), rect(0, 6, 8, 2)])
  expect(regions).toHaveLength(1)
  expect(regions[0].voids).toHaveLength(1)
  for (const shape of [
    'hip',
    'gable',
    'shed',
    'hidden',
    'terrace',
    'mansard',
    'butterfly',
    'cross-gable',
    'cross-hip',
  ] as const) {
    const layout = clipRoofLayout(
      roofLayout({ minX: 0, maxX: 8, minZ: 0, maxZ: 8, top: 3 }, { ...defaultRoof, shape, overhang: 0 }),
      regions[0].footprint,
      regions[0].voids,
    )
    expect(
      layout.faces.reduce(
        (area, face) => area + Math.abs(signedPlanArea(face.map(([x, , z]) => ({ x, z })))),
        0,
      ),
    ).toBeCloseTo(48)
    expect(
      layout.faces.some((face) =>
        containsPoint(
          face.map(([x, , z]) => ({ x, z })),
          { x: 4, z: 4 },
        ),
      ),
    ).toBe(false)
  }
})

test('existing generated room roofs repair on load and whole-roof controls stay available', () => {
  const project = fixtureProject(),
    building = project.buildings[0],
    level = building.levels[0]
  level.autoRoof = false
  level.rooms = [rect(0, 0, 4, 8), rect(4, 0, 4, 8)].map((polygon, index) => ({
    id: `room-${index}`,
    name: `Room ${index}`,
    polygon,
    material: 'tile',
  }))
  building.roofSections = level.rooms.map((room, index) => ({
    id: `old-roof-${index}`,
    name: `Plan roof ${index + 1}`,
    levelId: level.id,
    footprint: room.polygon,
    followFootprint: true,
    roof: { ...defaultRoof },
  }))
  const loaded = normalizeProject(project)
  expect(loaded.buildings[0].roofSections).toHaveLength(1)
  useProject.getState().setProject(loaded)
  const markup = renderToStaticMarkup(<RoofControls level={loaded.buildings[0].levels[0]} />)
  expect(markup).toContain('aria-label="Roof form"')
  expect(markup).toContain('aria-label="Roof covering"')
  expect(markup).toContain('Use one building roof')
  useProject.getState().editProject((copy) => {
    setBuildingRoof(copy.buildings[0], { shape: 'gable', material: 'concrete', color: '#aabbcc' })
    return copy
  })
  expect(useProject.getState().project!.buildings[0].roofSections![0].roof).toMatchObject({
    shape: 'gable',
    material: 'concrete',
    color: '#aabbcc',
  })
  useProject.getState().undo()
  expect(useProject.getState().project!.buildings[0].roofSections![0].roof.shape).toBe('hip')
  useProject.getState().setProject(null)
})

test('disconnected wings stay separate while their selected roof style applies to both', () => {
  const project = fixtureProject(),
    building = project.buildings[0],
    level = building.levels[0]
  level.rooms = [rect(0, 0, 4, 4), rect(8, 0, 4, 4)].map((polygon, index) => ({
    id: `${index}`,
    name: 'Wing',
    polygon,
    material: 'tile',
  }))
  rebuildImportedRoof(building, level)
  expect(building.roofSections).toHaveLength(2)
  setBuildingRoof(building, { shape: 'hidden', pitch: 10 })
  expect(building.roofSections!.every((section) => section.roof.shape === 'hidden')).toBe(true)
})

test('two courtyard cutouts touching at a point remain separate valid openings', () => {
  const regions = roofRegions([
    rect(0, 0, 6, 1),
    rect(0, 1, 1, 1),
    rect(2, 1, 4, 1),
    rect(0, 2, 2, 1),
    rect(3, 2, 3, 1),
    rect(0, 3, 6, 3),
  ])
  expect(regions).toHaveLength(1)
  expect(regions[0].voids).toHaveLength(2)
  const layout = clipRoofLayout(
    roofLayout({ minX: 0, minZ: 0, maxX: 6, maxZ: 6, top: 3 }, { ...defaultRoof, overhang: 0 }),
    regions[0].footprint,
    regions[0].voids,
  )
  expect(
    layout.faces.reduce((sum, face) => sum + Math.abs(signedPlanArea(face.map(([x, , z]) => ({ x, z })))), 0),
  ).toBeCloseTo(34)
})

test('roof ridges stop at courtyard openings instead of floating across them', () => {
  const segments = clipRoofEdges(
    [
      [
        [0, 4, 4],
        [8, 4, 4],
      ],
    ],
    rect(0, 0, 8, 8),
    [rect(2, 2, 4, 4)],
  )
  expect(segments).toEqual([
    [
      [0, 4, 4],
      [2, 4, 4],
    ],
    [
      [6, 4, 4],
      [8, 4, 4],
    ],
  ])
})

test('level alignment moves its roof and cutouts while an automatic fence follows the full building', () => {
  const project = fixtureProject(),
    building = project.buildings[0],
    level = building.levels[0]
  level.rooms = [rect(0, 0, 8, 2), rect(0, 2, 2, 4), rect(6, 2, 2, 4), rect(0, 6, 8, 2)].map(
    (polygon, i) => ({ id: `${i}`, name: 'Room', polygon, material: 'tile' }),
  )
  rebuildImportedRoof(building, level)
  building.siteFence = generateSiteFence(level)
  const before = structuredClone(building.roofSections![0]),
    bounds = siteBounds(building.siteFence)!
  translateLevel(level, { x: 20, z: -10 }, building)
  const after = building.roofSections![0]
  expect(after.footprint[0]).toEqual({ x: before.footprint[0].x + 20, z: before.footprint[0].z - 10 })
  expect(after.voids![0][0]).toEqual({ x: before.voids![0][0].x + 20, z: before.voids![0][0].z - 10 })
  expect(siteBounds(building.siteFence)!.minX).toBeCloseTo(bounds.minX + 20)
  expect(siteBounds(building.siteFence)!.maxZ).toBeCloseTo(bounds.maxZ - 10)
})
