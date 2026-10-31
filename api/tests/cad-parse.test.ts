import { expect, test } from 'bun:test'
import { parseDxf } from '../src/modules/cad/dxf-read'
import { placeEntities } from '../src/modules/cad/dxf-transform'
import { tessellate } from '../src/modules/cad/dxf-tessellate'
import { sceneToSvg } from '../src/modules/cad/svg'
import { CadFailure } from '../src/modules/cad/types'
import { dxfDocument, entity, groups, section, table } from './dxf-builder'
import { dxfPlanFixture } from './dxf-fixture'

const limits = { maxBytes: 32_000_000, maxEntities: 200_000, timeoutMs: 60_000 }
const line = (layer: string, x: number, y: number) =>
  entity('LINE', [
    [8, layer],
    [10, 0],
    [20, 0],
    [11, x],
    [21, y],
  ])
const text = (value: string) =>
  entity('TEXT', [
    [1, value],
    [8, 'TEXT'],
    [10, 10],
    [20, 10],
    [40, 200],
  ])

const drawing = (entities: string[][], layers: string[][] = []) =>
  dxfDocument([
    section(
      'HEADER',
      groups([
        [9, '$ACADVER'],
        [1, 'AC1015'],
        [9, '$INSUNITS'],
        [70, 6],
      ]),
    ),
    ...(layers.length ? [section('TABLES', table('LAYER', layers))] : []),
    section('ENTITIES', entities.flat()),
  ])

test('the plan fixture keeps visible layers and drops frozen ones', () => {
  const model = parseDxf(dxfPlanFixture, limits.maxEntities)
  expect(model.header['$INSUNITS']).toBe(4)
  expect(Object.keys(model.blocks)).toContain('DESK')
  const types = model.entities.map((item) => item.type)
  expect(types).toContain('LWPOLYLINE')
  expect(types).toContain('ARC')
  expect(types).toContain('CIRCLE')
  expect(types).not.toContain('LINE')
})

test('an entity switched off never reaches the raster', () => {
  const hidden = [
    '0',
    'LINE',
    ...groups([
      [8, 'WALLS'],
      [60, 1],
      [10, 0],
      [20, 0],
      [11, 100],
      [21, 100],
    ]),
  ]
  expect(() => parseDxf(drawing([hidden]), limits.maxEntities)).toThrow(/switched off or frozen/)
  const model = parseDxf(drawing([hidden, line('WALLS', 5, 5)]), limits.maxEntities)
  expect(model.entities).toHaveLength(1)
})

test('INSERT references expand into the block entities they place', () => {
  const model = parseDxf(dxfPlanFixture, limits.maxEntities)
  const placed = placeEntities(model, limits.maxEntities)
  const types = placed.map((item) => item.entity.type)
  expect(types).not.toContain('INSERT')
  expect(types.filter((type) => type === 'LWPOLYLINE')).toHaveLength(3)
  const desk = placed.find((item) => (item.entity as { layer?: string }).layer === 'FURN')
  expect(desk?.transform.x).toBe(4000)
  expect(desk?.transform.y).toBe(500)
})

test('entity caps fail closed rather than rendering a partial floor', () => {
  expect(() => parseDxf(dxfPlanFixture, 2)).toThrow(CadFailure)
  const model = parseDxf(dxfPlanFixture, limits.maxEntities)
  expect(() => placeEntities(model, 2)).toThrow(/expands past/)
})

test('empty and truncated drawings fail before any raster work', () => {
  expect(() => parseDxf(drawing([line('WALLS', 10, 10)]), limits.maxEntities)).not.toThrow()
  expect(() => parseDxf(drawing([]), limits.maxEntities)).toThrow(/no model-space geometry/)
  const truncated = '0\nSECTION\n2\nENTITIES\n0\nLINE\n8\nWALLS\n'
  expect(() => parseDxf(truncated, limits.maxEntities)).toThrow(/parse failed|no model-space geometry/)
})

test('hidden-only drawings refuse to render', () => {
  const source = drawing(
    [
      entity('LINE', [
        [8, 'OFF'],
        [10, 0],
        [20, 0],
        [11, 500],
        [21, 500],
      ]),
    ],
    [
      entity('LAYER', [
        [2, 'OFF'],
        [70, 1],
        [62, 8],
      ]),
    ],
  )
  expect(() => parseDxf(source, limits.maxEntities)).toThrow(/switched off or frozen/)
})

test('labels are tessellated and markup cannot escape the SVG', () => {
  const hostile = '"><image href="file:///etc/passwd" /><script>alert(1)</script>'
  const model = parseDxf(drawing([text(hostile), line('WALLS', 600, 400)]), limits.maxEntities)
  const scene = tessellate(placeEntities(model, limits.maxEntities))
  expect(scene.labels).toHaveLength(1)
  expect(scene.strokes.length).toBe(1)
  const { svg } = sceneToSvg(scene)
  expect(svg).not.toContain('<image')
  expect(svg).not.toContain('<script')
  expect(svg).toContain('&lt;script&gt;')
  expect(svg).toContain('&quot;')
  expect(svg.match(/<path /g)).toHaveLength(1)
})

test('bulges and arcs tessellate into bounded curves', () => {
  const model = parseDxf(dxfPlanFixture, limits.maxEntities)
  const scene = tessellate(placeEntities(model, limits.maxEntities))
  const curved = scene.strokes.filter((stroke) => stroke.points.length > 2)
  expect(curved.length).toBeGreaterThan(2)
  expect(scene.bounds.minX).toBe(0)
  expect(scene.bounds.maxX).toBeCloseTo(6000, 3)
  expect(scene.bounds.maxY).toBeCloseTo(4000, 3)
  expect(scene.entityCount).toBe(scene.strokes.length + scene.labels.length)
})
