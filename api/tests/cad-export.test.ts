import { expect, test } from 'bun:test'
import { buildCadScene } from '../../client/src/cad/scene'
import { writeDxf } from '../../client/src/cad/dxf-writer'
import { houseSample } from '../../client/src/domain/residentialSamples'
import { createSampleLibrary } from '../../client/src/domain/sampleLibrary'
import { normalizeProject } from '../../client/src/domain/levels'
import { parseDxf } from '../src/modules/cad/dxf-read'
import { dwgFromDxf } from '../src/workers/dwg-export'
import { cadSheetName } from '../../client/src/cad/sheetName'

const limits = 200_000

test('an exported sheet re-reads as the same drawing', () => {
  const scene = buildCadScene(houseSample()),
    model = parseDxf(writeDxf(scene), limits)
  expect(model.header.$ACADVER).toBe('AC1015')
  expect(model.header.$INSUNITS).toBe(6)
  expect(model.header.$MEASUREMENT).toBe(1)
  expect(model.entities.length).toBe(scene.entities.length)
  expect(Object.keys(model.layers)).toContain('A-WALL')
})

test('every entity type survives the round trip', () => {
  const scene = buildCadScene(houseSample()),
    model = parseDxf(writeDxf(scene), limits),
    count = (kind: string) => model.entities.filter((entity) => entity.type === kind).length,
    of = (kind: string) => scene.entities.filter((entity) => entity.kind === kind).length
  expect(count('LWPOLYLINE')).toBe(of('polyline'))
  expect(count('LINE')).toBe(of('line'))
  expect(count('ARC')).toBe(of('arc'))
  expect(count('TEXT')).toBe(of('text'))
  expect(
    model.entities.filter((entity) => entity.type === 'TEXT').map((entity) => (entity as any).text),
  ).toContain('Living')
})

test('wall footprints keep their vertices and layer', () => {
  const scene = buildCadScene(houseSample()),
    model = parseDxf(writeDxf(scene), limits),
    rings = scene.entities.filter((entity) => entity.kind === 'polyline' && entity.layer === 'A-WALL'),
    parsed = model.entities.filter((entity) => entity.type === 'LWPOLYLINE' && entity.layer === 'A-WALL')
  expect(parsed.length).toBe(rings.length)
  const first = parsed[0] as unknown as { shape?: unknown; vertices: { x: number; y: number }[] },
    points = (rings[0] as { points: { x: number; y: number }[] }).points
  expect(Boolean(first.shape)).toBe(true)
  expect(first.vertices.length).toBe(points.length)
  // The sheet rounds to six decimals, so vertices have to match within that tolerance.
  expect(
    first.vertices.every(
      (vertex, index) =>
        Math.abs(vertex.x - points[index].x) < 1e-6 && Math.abs(vertex.y - points[index].y) < 1e-6,
    ),
  ).toBe(true)
})

test('every shipped design exports and re-reads at full size', () => {
  for (const sample of createSampleLibrary()) {
    const project = normalizeProject(sample.project),
      scene = buildCadScene(project),
      model = parseDxf(writeDxf(scene), limits),
      stacked = parseDxf(writeDxf(buildCadScene(project, { allLevels: true })), limits)
    expect([sample.id, model.entities.length]).toEqual([sample.id, scene.entities.length])
    expect(stacked.entities.length).toBeGreaterThan(0)
    expect(scene.layers.every((layer) => layer.name.length <= 31 && !/[ <>:;"'`|=]/.test(layer.name))).toBe(
      true,
    )
  }
})

test('a curved wall and a framed opening reach the sheet', () => {
  const curved = createSampleLibrary().find((sample) =>
    normalizeProject(sample.project).buildings[0].levels.some((level) =>
      level.walls.some((wall) => wall.curve),
    ),
  )
  expect(curved).toBeDefined()
  const scene = buildCadScene(normalizeProject(curved!.project))
  const rings = scene.entities.filter(
    (entity) => entity.kind === 'polyline' && entity.layer === 'A-WALL',
  ) as any[]
  expect(rings.some((ring) => ring.points.length > 12)).toBe(true)
  expect(parseDxf(writeDxf(scene), limits).entities.length).toBe(scene.entities.length)
})

test('sheet names follow the floor the user picked', () => {
  const project = houseSample(),
    level = project.buildings[0].levels[0],
    single = cadSheetName(project, { levelId: level.id }, 'dxf'),
    stacked = cadSheetName(project, { allLevels: true }, 'dwg')
  expect(single).toContain(level.name.toLowerCase().replace(/\s+/g, '-'))
  expect(single).toMatch(/-\d{4}-\d{2}-\d{2}\.dxf$/)
  expect(stacked).toContain('-all-floors-')
  expect(stacked.endsWith('.dwg')).toBe(true)
})

test('DWG export refuses politely until a converter is installed', async () => {
  const missing = { DXF_TO_DWG_CONVERTER_PATH: '', CAD_MAX_BYTES: 1, CAD_CONVERT_TIMEOUT_MS: 1 } as never
  await expect(dwgFromDxf(new TextEncoder().encode('0\r\nEOF\r\n'), missing, 'dxf')).resolves.toBeNull()
  await expect(dwgFromDxf(new TextEncoder().encode('0\r\nEOF\r\n'), missing, 'dwg')).rejects.toThrow(
    /converter/,
  )
})
