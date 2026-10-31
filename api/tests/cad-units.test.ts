import { expect, test } from 'bun:test'
import { metresPerUnit, metresPerPixel, unitMetres, unitsFromHeader } from '../src/modules/cad/units'
import type { CadUnit } from '../src/modules/cad/types'

test('every documented $INSUNITS code maps to a unit', () => {
  expect(unitsFromHeader({ $INSUNITS: 1 })).toBe('in')
  expect(unitsFromHeader({ $INSUNITS: 2 })).toBe('ft')
  expect(unitsFromHeader({ $INSUNITS: 4 })).toBe('mm')
  expect(unitsFromHeader({ $INSUNITS: 5 })).toBe('cm')
  expect(unitsFromHeader({ $INSUNITS: 6 })).toBe('m')
})

test('missing or unsupported unit codes stay unknown instead of guessing', () => {
  expect(unitsFromHeader({})).toBe('unknown')
  expect(unitsFromHeader({ $INSUNITS: 0 })).toBe('unknown')
  expect(unitsFromHeader({ $INSUNITS: 21 })).toBe('unknown')
  expect(unitsFromHeader(null as unknown as Record<string, unknown>)).toBe('unknown')
})

test('unknown units have no metre length so callers can warn', () => {
  expect(unitMetres('unknown')).toBeNull()
  expect(unitMetres('m')).toBe(1)
  expect(Object.entries(metresPerUnit)).toEqual([
    ['mm', 0.001],
    ['cm', 0.01],
    ['m', 1],
    ['in', 0.0254],
    ['ft', 0.3048],
  ])
})

test('metres per pixel divides the drawn extent by the raster size', () => {
  expect(metresPerPixel(6000, 3000, 'mm')).toBeCloseTo(0.002, 9)
  expect(metresPerPixel(6, 3000, 'm')).toBeCloseTo(0.002, 9)
  const units: CadUnit = 'unknown'
  expect(metresPerPixel(6000, 3000, units)).toBeNull()
  expect(metresPerPixel(0, 3000, 'mm')).toBeNull()
  expect(metresPerPixel(6000, 0, 'mm')).toBeNull()
})
