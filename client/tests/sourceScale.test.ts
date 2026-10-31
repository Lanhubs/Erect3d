import { expect, test } from 'bun:test'
import { calibrationFromMetresPerPixel, initialAutoScale } from '../src/geometry/autoScale'
import { replaceSource } from '../src/domain/replaceSource'
import { isCadMime, isPdfMime, isRasterMime, isSourceMime } from '../src/domain/sourceMime'
import type { SourceDocument } from '../src/domain/types'
import { houseSample } from '../src/domain/residentialSamples'

const drawing = (extra: Partial<SourceDocument> = {}): SourceDocument => ({
  id: 'source_dwg_1',
  name: 'tower level 3.dwg',
  mime: 'image/vnd.dwg',
  originalBytes: 481_502,
  width: 2400,
  height: 1600,
  units: 'mm',
  metresPerPixel: 0.025,
  ...extra,
})

test('a declared drawing scale becomes a trusted calibration, not an estimate', () => {
  const exact = calibrationFromMetresPerPixel(2400, 1600, 0.025)
  expect(exact.method).toBe('manual')
  expect(exact.basisPixels).toBe(2400)
  expect(exact.knownMetres).toBeCloseTo(60, 9)
  expect(exact.metresPerPixel).toBe(0.025)
  // The 12 m fallback stays exactly that: a fallback, only for a raster with no declared units.
  expect(initialAutoScale(2400, 1600).knownMetres).toBe(12)
})

test('a CAD source seeds its own scale while a picture keeps the auto fit', () => {
  const scanned = houseSample(),
    first = scanned.buildings[0].levels[0]
  // The floor starts as a scanned plan: geometry the new drawing must not be left standing on.
  first.sourceId = 'source_scan'
  scanned.sources = [
    drawing({ id: 'source_scan', name: 'scan.png', mime: 'image/png', metresPerPixel: undefined }),
  ]
  expect(first.walls.length).toBeGreaterThan(0)
  const replaced = replaceSource(scanned, drawing(), first.id).project,
    floor = replaced.buildings[0].levels[0]
  expect(floor.sourceId).toBe('source_dwg_1')
  expect(floor.calibration.method).toBe('manual')
  expect(floor.calibration.metresPerPixel).toBe(0.025)
  expect(replaced.calibration?.metresPerPixel).toBe(0.025)
  expect(replaced.sources.map((source) => source.id)).toEqual(['source_dwg_1'])
  expect(floor.walls.length).toBe(0)
  const unitless = replaceSource(scanned, drawing({ units: 'unknown', metresPerPixel: undefined }), first.id)
    .project.buildings[0].levels[0]
  expect(unitless.calibration.method).toBe('auto')
  expect(unitless.calibration.knownMetres).toBe(12)
})

test('the two MIME families are named, never guessed from a prefix', () => {
  expect(isCadMime('image/vnd.dxf')).toBe(true)
  expect(isCadMime('image/vnd.dwg')).toBe(true)
  expect(isCadMime('image/png')).toBe(false)
  expect(isRasterMime('image/png')).toBe(true)
  expect(isRasterMime('image/jpeg')).toBe(true)
  // A DWG does start with "image/" but it is not something the browser can decode.
  expect(isRasterMime('image/vnd.dwg')).toBe(false)
  expect(isPdfMime('application/pdf')).toBe(true)
  expect(isSourceMime('image/vnd.dxf')).toBe(true)
  expect(isSourceMime('image/webp')).toBe(false)
})
