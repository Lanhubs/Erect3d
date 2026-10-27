import { expect, test } from 'bun:test'
import sharp from 'sharp'
import { neutralInk } from '../src/workers/neutral-ink'
import { measureSource } from '../src/workers/source-measurements'
import { bytesHash } from '../src/modules/assets/validation'
test('broad coloured fills are excluded only from detection, preserving black edges, narrow coloured walls and original pixels', async () => {
  const bytes = await sharp(
    Buffer.from(
      '<svg width="240" height="180"><rect width="240" height="180" fill="white"/><rect x="20" y="20" width="100" height="100" fill="#349be8" stroke="black" stroke-width="4"/><path d="M160 20V150" stroke="blue" stroke-width="4"/></svg>',
    ),
  )
    .ensureAlpha()
    .raw()
    .toBuffer()
  const before = Buffer.from(bytes),
    result = neutralInk(bytes, 240, 180)
  const at = (x: number, y: number) => (y * 240 + x) * 4
  expect(result.suppressed).toBeGreaterThan(5000)
  expect([...result.pixels.slice(at(60, 60), at(60, 60) + 4)]).toEqual([255, 255, 255, 255])
  expect([...result.pixels.slice(at(20, 60), at(20, 60) + 3)]).toEqual([0, 0, 0])
  expect([...result.pixels.slice(at(160, 60), at(160, 60) + 3)]).toEqual([0, 0, 255])
  expect(bytes).toEqual(before)
})
test('monochrome and transparent source evidence is not transformed by the colour-fill mask', async () => {
  const bytes = await sharp(
    Buffer.from(
      '<svg width="100" height="100"><rect x="10" y="10" width="80" height="80" fill="none" stroke="black" stroke-width="6"/></svg>',
    ),
  )
    .ensureAlpha()
    .raw()
    .toBuffer()
  const result = neutralInk(bytes, 100, 100)
  expect(result.suppressed).toBe(0)
  expect(result.pixels).toEqual(new Uint8ClampedArray(bytes))
})
test('a blue room remains bounded by measured thin black walls rather than one filled wall band, without rewriting its source', async () => {
  const bytes = await sharp(
    Buffer.from(
      '<svg width="400" height="300"><rect width="400" height="300" fill="white"/><rect x="40" y="40" width="320" height="220" fill="#349be8" stroke="black" stroke-width="6"/></svg>',
    ),
  )
    .png()
    .toBuffer()
  const hash = bytesHash(bytes),
    measured = await measureSource(bytes)
  expect(measured.report.suppressedColourFillPixels).toBeGreaterThan(10000)
  const walls = measured.candidates.filter((candidate) => candidate.kind === 'wall')
  expect(walls.length).toBeGreaterThanOrEqual(4)
  expect(walls.every((candidate) => candidate.thickness! < 0.05)).toBe(true)
  expect(bytesHash(bytes)).toBe(hash)
})
