import { expect, test } from 'bun:test'
import { buildCadScene } from '../src/cad/scene'
import { writeDxf } from '../src/cad/dxf-writer'
import { assertWithinBudget, levelPlacements, maxCadEntities } from '../src/cad/sceneLevels'
import { entityPoints, type CadEntity } from '../src/cad/types'
import { houseSample } from '../src/domain/residentialSamples'
import { towerValidationSample } from '../src/domain/towerValidationSample'
import { atWall } from '../src/geometry/math'
import { containsPoint } from '../src/geometry/polygons'

const onLayer = (entities: CadEntity[], layer: string) => entities.filter((entity) => entity.layer === layer)
const layersOf = (entities: CadEntity[]) => [...new Set(entities.map((entity) => entity.layer))].sort()

/** DXF is code/value lines: rebuild the pairs instead of guessing positions in the text. */
function pairs(dxf: string) {
  const lines = dxf.split('\r\n'),
    out: [string, string][] = []
  for (let index = 0; index + 1 < lines.length; index += 2) out.push([lines[index], lines[index + 1]])
  return out
}
const valuesFor = (dxf: string, code: string) =>
  pairs(dxf)
    .filter(([key]) => key === code)
    .map(([, value]) => value)

test('a house floor becomes layered CAD geometry in metres', () => {
  const project = houseSample(),
    level = project.buildings[0].levels[0],
    scene = buildCadScene(project)
  const walls = onLayer(scene.entities, 'A-WALL')
  expect(walls.length).toBeGreaterThan(level.walls.length)
  expect(walls.every((wall) => wall.kind === 'polyline' && wall.closed && wall.points.length >= 4)).toBe(true)
  expect(onLayer(scene.entities, 'A-ROOM').length).toBe(level.rooms.length)
  const labels = onLayer(scene.entities, 'A-ROOM-NAME')
  expect(labels.map((label) => (label.kind === 'text' ? label.value : ''))).toEqual(
    level.rooms.map((room) => room.name),
  )
  expect(labels.every((label) => label.kind === 'text' && label.height >= 0.12 && label.height <= 0.5)).toBe(
    true,
  )
  expect(onLayer(scene.entities, 'A-DOOR').some((door) => door.kind === 'arc')).toBe(true)
  expect(onLayer(scene.entities, 'A-SLAB').length).toBeGreaterThan(0)
  // A 14 by 10 metre house keeps its sheet inside that footprint plus wall thickness.
  expect(scene.bounds.maxX).toBeLessThan(16)
  expect(scene.bounds.maxY).toBeLessThan(12)
  expect(scene.layers.find((layer) => layer.name === 'A-WALL')?.colour).toBe(7)
})

test('openings cut the wall run instead of drawing over it', () => {
  const level = houseSample().buildings[0].levels[0],
    entities = buildCadScene(houseSample()).entities,
    // CAD Y mirrors model Z, so rings go back to model space for the containment test.
    rings = onLayer(entities, 'A-WALL')
      .filter((wall) => wall.kind === 'polyline')
      .map((wall) => (wall.kind === 'polyline' ? wall.points : []))
      .map((points) => points.map((point) => ({ x: point.x, z: -point.y })))
  for (const door of level.doors) {
    const wall = level.walls.find((item) => item.id === door.wallId)!,
      middle = atWall(wall, door.offset + door.width / 2)
    expect(rings.some((ring) => containsPoint(ring, middle))).toBe(false)
  }
  expect(onLayer(entities, 'A-DOOR').length).toBe(level.doors.length * 4)
  expect(onLayer(entities, 'A-WINDOW').length).toBe(level.windows.length * 3)
})

test('stacking every storey suffixes layers and keeps authored heights', () => {
  const project = houseSample(),
    single = buildCadScene(project),
    stacked = buildCadScene(project, { allLevels: true })
  expect(layersOf(stacked.entities)).toEqual(layersOf(single.entities).map((layer) => `${layer}-L1`))
  expect(stacked.bounds).toEqual(single.bounds)
  expect(
    single.entities.every((entity) => entityPoints(entity).every((point) => point.z === undefined)),
  ).toBe(true)
})

test('a typical-floor template repeats at each linked elevation', () => {
  const project = towerValidationSample(4),
    placements = levelPlacements(project, { allLevels: true }),
    authored = project.buildings[0].levels.length
  expect(placements.length).toBeGreaterThan(authored)
  expect(placements.map((placement) => placement.suffix)).toEqual(
    placements.map((_, index) => `L${index + 1}`),
  )
  expect(
    placements.every(
      (placement, index) => index === 0 || placement.elevation > placements[index - 1].elevation,
    ),
  ).toBe(true)
  const scene = buildCadScene(project, { allLevels: true })
  expect(layersOf(scene.entities).some((layer) => layer.endsWith('-L3'))).toBe(true)
  expect(scene.entities.some((entity) => entityPoints(entity).some((point) => (point.z || 0) > 3))).toBe(true)
})

test('the writer emits ASCII pairs, metric units and one table row per layer', () => {
  const scene = buildCadScene(houseSample()),
    dxf = writeDxf(scene)
  expect(dxf.startsWith('0\r\nSECTION\r\n')).toBe(true)
  expect(dxf.endsWith('0\r\nEOF\r\n')).toBe(true)
  expect(valuesFor(dxf, '9')[0]).toBe('$ACADVER')
  expect(valuesFor(dxf, '1')).toContain('AC1015')
  expect(valuesFor(dxf, '70')).toContain('6')
  expect(valuesFor(dxf, '2')).toContain('A-DOOR')
  expect(valuesFor(dxf, '62').length).toBe(scene.layers.length)
  expect(valuesFor(dxf, '0').filter((value) => value === 'LWPOLYLINE').length).toBe(
    scene.entities.filter((entity) => entity.kind === 'polyline').length,
  )
})

test('text survives the sheet without control codes or stray pairs', () => {
  const scene = buildCadScene(houseSample())
  scene.entities.push({
    kind: 'text',
    layer: 'A-ANNO',
    at: { x: 1, y: 1 },
    height: 0.2,
    value: 'Bed 01\n<script>%%d',
  })
  const dxf = writeDxf(scene)
  expect(valuesFor(dxf, '1')).toContain('Bed 01 <script>% d')
  expect(dxf).not.toMatch(/[\u0000-\u0009]/)
  expect(pairs(dxf).every(([code]) => /^\d+$/.test(code))).toBe(true)
})

test('an over-complex design asks for a narrower scope', () => {
  const tooMany = Array.from({ length: maxCadEntities + 1 }, (_, index): CadEntity => ({
    kind: 'line',
    layer: 'A-ANNO',
    a: { x: index, y: 0 },
    b: { x: index, y: 1 },
  }))
  expect(() => assertWithinBudget(tooMany)).toThrow(/Export one floor at a time/)
  expect(() => assertWithinBudget(tooMany.slice(0, 10))).not.toThrow()
})
