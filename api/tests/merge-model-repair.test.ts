import { expect, test } from 'bun:test'
import type { Intelligence } from '../src/contracts/analysis'
import { mergeModelRepair } from '../src/workers/merge-model-repair'
const original: Intelligence = {
  coordinatesVersion: 1,
  coordinateSystem: 'normalized-image-top-left',
  candidates: [],
  warnings: [],
  architecturalRequirements: { typology: 'house', systems: [] },
  understanding: {
    buildingType: 'house',
    footprint: [
      { x: 0.1, y: 0.1 },
      { x: 0.9, y: 0.1 },
      { x: 0.9, y: 0.9 },
      { x: 0.1, y: 0.9 },
    ],
    conventions: [],
    circulation: [],
    uncertainties: [],
    scale: {
      a: { x: 0.1, y: 0.1 },
      b: { x: 0.9, y: 0.1 },
      knownMetres: 12,
      origin: 'annotated',
      evidence: '12 m dimension',
    },
  },
}
test('an opening repair cannot replace the roof requirements, source scale or footprint casually', () => {
  const repair: Intelligence = {
    ...original,
    architecturalRequirements: { typology: 'office', systems: [] },
    understanding: {
      ...original.understanding!,
      footprint: [],
      scale: { ...original.understanding!.scale!, knownMetres: 3, origin: 'inferred' },
    },
  }
  const result = mergeModelRepair(
    original,
    repair,
    { status: 'blocked', issues: [{ code: 'INVALID_HOST', severity: 'error', message: 'Repair door host' }] },
    'full',
    { width: 1000, height: 800, metresPerPixel: 0.01 },
  )
  expect(result.architecturalRequirements).toEqual(original.architecturalRequirements)
  expect(result.understanding).toEqual(original.understanding)
  const scale = mergeModelRepair(
    original,
    repair,
    {
      status: 'needs-review',
      issues: [
        { code: 'SCALE_REFERENCE_INTERIOR', severity: 'warning', message: 'Wrong dimension endpoints' },
      ],
    },
    'full',
    { width: 1000, height: 800, metresPerPixel: 0.01 },
  )
  expect(scale.understanding!.scale).toEqual(repair.understanding!.scale)
})
