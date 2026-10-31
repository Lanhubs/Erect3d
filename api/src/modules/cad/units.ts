import type { CadUnit } from './types'

const insUnits: Record<number, CadUnit> = {
  1: 'in',
  2: 'ft',
  4: 'mm',
  5: 'cm',
  6: 'm',
}
export const metresPerUnit: Record<Exclude<CadUnit, 'unknown'>, number> = {
  mm: 0.001,
  cm: 0.01,
  m: 1,
  in: 0.0254,
  ft: 0.3048,
}

export function unitsFromHeader(header: Record<string, unknown>): CadUnit {
  const declared = Number(header?.['$INSUNITS'] ?? 0)
  return insUnits[declared] ?? 'unknown'
}

export function unitMetres(units: CadUnit): number | null {
  return units === 'unknown' ? null : metresPerUnit[units]
}

// A raster of `pixels` long side covering `extentUnits` of a drawing whose unit is `metres`
// long gives the exact scale the analyser needs.
export function metresPerPixel(extentUnits: number, pixels: number, units: CadUnit): number | null {
  const perUnit = unitMetres(units)
  if (!perUnit || !(extentUnits > 0) || !(pixels > 0)) return null
  return (extentUnits * perUnit) / pixels
}
