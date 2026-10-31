import { expect, test } from 'bun:test'
import sharp from 'sharp'
import { dxfToRaster } from '../src/modules/cad/render'
import { maximumRasterSide } from '../src/modules/cad/raster'
import { dxfDocument, entity, groups, section } from './dxf-builder'
import { dxfPlanFixture } from './dxf-fixture'

const limits = { maxBytes: 32_000_000, maxEntities: 200_000, timeoutMs: 60_000 }

const darkPixels = async (png: Uint8Array) => {
  const { data, info } = await sharp(Buffer.from(png)).grayscale().raw().toBuffer({ resolveWithObject: true })
  let dark = 0
  for (const value of data) if (value < 128) dark++
  return { dark, total: info.width * info.height }
}

test('a millimetre DXF rasterises to an upright PNG with an exact scale', async () => {
  const result = await dxfToRaster(dxfPlanFixture, limits)
  expect(result.format).toBe('dxf')
  expect(result.units).toBe('mm')
  expect(result.width).toBeLessThanOrEqual(maximumRasterSide)
  expect(result.width).toBe(3000)
  expect(result.height).toBeGreaterThan(1000)
  // A 6 m wide drawing across the full page gives roughly two millimetres per pixel.
  expect(result.metresPerPixel).toBeCloseTo(0.00203, 5)
  expect(result.warnings).toEqual([])
  expect(result.entityCount).toBeGreaterThan(5)
  const { dark, total } = await darkPixels(result.png)
  expect(dark).toBeGreaterThan(total * 0.005)
  expect(dark).toBeLessThan(total * 0.5)
})

test('text-only drawings render ink, proving a font is installed', async () => {
  const source = dxfDocument([
    section(
      'HEADER',
      groups([
        [9, '$ACADVER'],
        [1, 'AC1015'],
        [9, '$INSUNITS'],
        [70, 4],
      ]),
    ),
    section('ENTITIES', [
      ...entity('TEXT', [
        [1, 'LIVING'],
        [8, 'TEXT'],
        [10, 0],
        [20, 0],
        [40, 300],
      ]),
      ...entity('MTEXT', [
        [1, 'KITCHEN'],
        [8, 'TEXT'],
        [10, 400],
        [20, 400],
        [40, 300],
      ]),
    ]),
  ])
  const result = await dxfToRaster(source, limits)
  const { dark } = await darkPixels(result.png)
  expect(dark).toBeGreaterThan(50)
})

test('a drawing with nothing to draw fails before producing an empty page', async () => {
  const source = dxfDocument([
    section(
      'HEADER',
      groups([
        [9, '$ACADVER'],
        [1, 'AC1015'],
        [9, '$INSUNITS'],
        [70, 6],
      ]),
    ),
    section('ENTITIES', [
      ...entity('POINT', [
        [8, 'WALLS'],
        [10, 0],
        [20, 0],
      ]),
    ]),
  ])
  await expect(dxfToRaster(source, limits)).rejects.toThrow(/nothing that can be drawn/)
})

test('a unitless drawing still rasterises but warns about its scale', async () => {
  const source = dxfDocument([
    section(
      'HEADER',
      groups([
        [9, '$ACADVER'],
        [1, 'AC1015'],
      ]),
    ),
    section('ENTITIES', [
      ...entity('LINE', [
        [8, 'WALLS'],
        [10, 0],
        [20, 0],
        [11, 1200],
        [21, 800],
      ]),
    ]),
  ])
  const result = await dxfToRaster(source, limits)
  expect(result.units).toBe('unknown')
  expect(result.metresPerPixel).toBeNull()
  expect(result.warnings).toContain('units-unknown')
  expect(result.width).toBeGreaterThan(2)
})
