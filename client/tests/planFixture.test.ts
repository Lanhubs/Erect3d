import { expect, test } from 'bun:test'
import { preparePlan } from '../src/workers/opencv'
import { scanWalls } from '../src/workers/analyze'
import { scanThinFeatures } from '../src/workers/thinFeatures'
import { estimateAutoScale } from '../src/geometry/autoScale'
import { findOpeningCandidates } from '../src/geometry/openingCandidates'
import { assembleDraft } from '../src/geometry/reconstruct'
import type { Wall } from '../src/domain/types'

test('uploaded plan leaves its white margin as site space and detects drawn door leaves', async () => {
  const width = 432, height = 378
  const pixels = new Uint8ClampedArray(await Bun.file('tests/fixtures/white-margin-floor-plan.rgba').arrayBuffer())
  expect(pixels.length).toBe(width * height * 4)
  const { structural, fine } = await preparePlan(pixels, width, height)
  const lines = scanWalls(structural, width, height)
  expect(lines.length).toBeGreaterThan(25)
  expect(Math.min(...lines.map(line => Math.min(line.y1, line.y2)))).toBeGreaterThanOrEqual(65)
  const metresPerPixel = estimateAutoScale(lines, width, height).metresPerPixel
  const point = (x: number, y: number) => ({ x: x * metresPerPixel, z: y * metresPerPixel })
  const walls: Wall[] = lines.map((line, index) => ({ id: String(index), start: point(line.x1, line.y1),
    end: point(line.x2, line.y2), thickness: line.thicknessPixels * metresPerPixel,
    height: 2.9, material: 'plaster' }))
  const features = scanThinFeatures(fine, structural, width, height).map(line => ({
    kind: line.kind, start: point(line.x1, line.y1), end: point(line.x2, line.y2),
  }))
  const openings = findOpeningCandidates(walls, features)
  const doors = openings.filter(opening => opening.choice === 'door')
  expect(doors.length).toBeGreaterThanOrEqual(4)
  const draft = assembleDraft(walls, openings)
  expect(draft.doors.length).toBeGreaterThanOrEqual(4)
  expect(Math.min(...draft.walls.flatMap(wall => [wall.start.z, wall.end.z])) / metresPerPixel).toBeGreaterThanOrEqual(65)
  expect(doors.some(door => Math.abs(door.start.x / metresPerPixel - 6) < 4 && door.start.z / metresPerPixel > 240)).toBe(true)
  expect(openings.find(opening => Math.abs(opening.start.x / metresPerPixel - 372) < 4 && Math.abs(opening.start.z / metresPerPixel - 87) < 4)?.choice).not.toBe('door')
})

test('transparent white-looking margins cannot become structural geometry', async () => {
  const width = 120, height = 120
  const pixels = new Uint8ClampedArray(width * height * 4)
  for (let y = 40; y < height; y++) for (let x = 0; x < width; x++) {
    const index = (y * width + x) * 4
    pixels[index] = pixels[index + 1] = pixels[index + 2] = 255
    pixels[index + 3] = 255
    if (x >= 12 && x <= 107 && y >= 50 && y <= 109 &&
      (x <= 15 || x >= 104 || y <= 53 || y >= 106))
      pixels[index] = pixels[index + 1] = pixels[index + 2] = 0
  }
  const { structural } = await preparePlan(pixels, width, height)
  const walls = scanWalls(structural, width, height)
  expect(walls.length).toBeGreaterThanOrEqual(4)
  expect(Math.min(...walls.map(wall => Math.min(wall.y1, wall.y2)))).toBeGreaterThanOrEqual(49)
})

test('the supplied floor plan still excludes its top margin when that margin is transparent', async () => {
  const width = 432, height = 378
  const pixels = new Uint8ClampedArray(await Bun.file('tests/fixtures/white-margin-floor-plan.rgba').arrayBuffer())
  for (let index = 0; index < width * 65 * 4; index++) pixels[index] = 0
  const { structural } = await preparePlan(pixels, width, height)
  const walls = scanWalls(structural, width, height)
  expect(walls.length).toBeGreaterThan(25)
  expect(Math.min(...walls.map(wall => Math.min(wall.y1, wall.y2)))).toBeGreaterThanOrEqual(65)
})
