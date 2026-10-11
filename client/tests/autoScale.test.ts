import { expect, test } from 'bun:test'
import { estimateAutoScale, initialAutoScale, setEstimatedSpan } from '../src/geometry/autoScale'

test('a new image gets a usable provisional scale without point selection', () => {
  const scale = initialAutoScale(205, 180)
  expect(scale.method).toBe('auto')
  expect(scale.metresPerPixel).toBeGreaterThan(0)
  expect(scale.basisPixels).toBe(205)
})

test('detected wall span and stroke width refine the automatic estimate', () => {
  const estimate = estimateAutoScale([
    { x1: 100, y1: 50, x2: 800, y2: 50, thicknessPixels: 10 },
    { x1: 100, y1: 50, x2: 100, y2: 650, thicknessPixels: 10 },
  ], 1920, 1941)
  expect(estimate.method).toBe('auto')
  expect(estimate.basisPixels).toBe(700)
  expect(estimate.knownMetres).toBeGreaterThan(10)
  expect(estimate.knownMetres).toBeLessThan(15)
  const adjusted = setEstimatedSpan(estimate, 9)
  expect(adjusted.metresPerPixel).toBeCloseTo(9 / 700)
  expect(adjusted.method).toBe('manual')
})
