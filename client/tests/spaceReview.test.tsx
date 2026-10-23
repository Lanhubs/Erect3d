import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { fixtureProject } from '../src/domain/fixture'
import { acceptInterpretation } from '../src/domain/acceptInterpretation'
import type { Wall } from '../src/domain/types'
import { defaultRoof } from '../src/domain/types'
import { containsPoint } from '../src/geometry/polygons'
import { enclosedSpaces } from '../src/geometry/roomTopology'
import { includedSpaces, spaceKey } from '../src/geometry/spaceReview'
import { SoftwarePreview } from '../src/rendering/SoftwarePreview'
import { buildingQuantities, levelQuantities } from '../src/geometry/quantities'
import { normalizeProject } from '../src/domain/levels'

const segments = [
  [0, 0, 8, 0],
  [8, 0, 8, 4],
  [8, 4, 0, 4],
  [0, 4, 0, 0],
  [4, 0, 4, 4],
]
const walls: Wall[] = segments.map(([x, z, endX, endZ], index) => ({
  id: `wall-${index}`,
  start: { x, z },
  end: { x: endX, z: endZ },
  thickness: 0.2,
  height: 3,
  material: 'plaster',
}))

test('excluded spaces stay attached to geometry when another enclosure disappears', () => {
  const polygons = enclosedSpaces(walls),
    excluded = polygons.find((polygon) => containsPoint(polygon, { x: 2, z: 2 }))!
  const reversed = [...excluded.slice(2), ...excluded.slice(0, 2)].reverse()
  expect(spaceKey(reversed)).toBe(spaceKey(excluded))
  const choices = { [spaceKey(excluded)]: false }
  expect(includedSpaces([polygons[1], polygons[0]], choices)).toHaveLength(1)
  expect(includedSpaces([reversed], choices)).toHaveLength(0)
})

test('excluding a space removes only its floor and roof, including on aligned levels', () => {
  const project = fixtureProject(),
    level = project.buildings[0].levels[0],
    polygons = enclosedSpaces(walls)
  level.alignment = { x: 10, z: 20 }
  project.buildings[0].roof = { ...defaultRoof, shape: 'hidden', overhang: 0 }
  const excluded = polygons.find((polygon) => containsPoint(polygon, { x: 2, z: 2 }))!
  acceptInterpretation(project, level.id, walls, [], [], true, { [spaceKey(excluded)]: false })
  expect(level.walls).toHaveLength(5)
  expect(level.rooms).toHaveLength(1)
  expect(level.slabs).toHaveLength(1)
  expect(project.buildings[0].roofSections).toHaveLength(1)
  expect(buildingQuantities(project.buildings[0]).roofArea).toBeCloseTo(16)
  expect(levelQuantities(level).floorArea).toBeCloseTo(16)
  for (const polygon of [
    ...level.rooms.map((room) => room.polygon),
    ...level.slabs!.map((slab) => slab.polygon),
    ...project.buildings[0].roofSections!.map((section) => section.footprint),
  ]) {
    expect(containsPoint(polygon, { x: 12, z: 22 })).toBe(false)
    expect(containsPoint(polygon, { x: 16, z: 22 })).toBe(true)
  }
})

test('excluding every enclosure cannot restore an implicit rectangular floor or roof', () => {
  const project = fixtureProject(),
    level = project.buildings[0].levels[0]
  const choices = Object.fromEntries(enclosedSpaces(walls).map((polygon) => [spaceKey(polygon), false]))
  acceptInterpretation(project, level.id, walls, [], [], true, choices)
  expect(level.rooms).toHaveLength(0)
  expect(level.slabs).toHaveLength(0)
  expect(level.autoSlab).toBe(false)
  expect(level.autoRoof).toBe(false)
  expect(project.buildings[0].roofSections || []).toHaveLength(0)
  expect(buildingQuantities(project.buildings[0]).roofArea).toBe(0)
  const reloaded = normalizeProject(JSON.parse(JSON.stringify(project))).buildings[0].levels[0]
  expect(reloaded.autoRoof).toBe(false)
  expect(reloaded.autoSlab).toBe(false)
  expect(reloaded.slabs).toHaveLength(0)
  const markup = renderToStaticMarkup(
    <SoftwarePreview
      level={reloaded}
      selection={null}
      select={() => {}}
      roofShown
      top
      sectionHeight={null}
    />,
  )
  expect(markup).not.toContain('#bcb9ad')
  expect(markup).not.toContain(`fill="${defaultRoof.color}"`)
  expect(markup).toContain('Software-rendered 3D building preview')
})
