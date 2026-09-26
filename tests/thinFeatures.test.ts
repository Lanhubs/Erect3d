import { expect, test } from 'bun:test'
import { scanThinFeatures } from '../src/workers/thinFeatures'

test('thin diagonal door leaf survives separately from structural wall mask', () => {
  const width = 100, height = 80
  const fine = new Uint8Array(width * height), structural = new Uint8Array(width * height)
  for (let x = 20; x <= 45; x++) fine[(x + 4) * width + x] = 1
  const lines = scanThinFeatures(fine, structural, width, height)
  expect(lines.some(item => item.kind === 'diagonal' && item.x1 === 20 && item.x2 >= 44)).toBe(true)
})

test('thick structural lines do not leak into the thin feature pass', () => {
  const width = 100, height = 80
  const fine = new Uint8Array(width * height), structural = new Uint8Array(width * height)
  for (let x = 10; x <= 80; x++) for (let y = 20; y <= 30; y++) {
    fine[y * width + x] = 1; structural[y * width + x] = 1
  }
  expect(scanThinFeatures(fine, structural, width, height)).toHaveLength(0)
})
