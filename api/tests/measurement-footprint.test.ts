import { expect, test } from 'bun:test'
import type { Candidate, Intelligence } from '../src/contracts/analysis'
import { classifiedMeasurements } from '../src/workers/source-measurements'
import { reconcile } from '../src/modules/ai/reconcile'
import { buildableCandidates } from '../src/modules/plan-analysis/quality'
import { validateFootprint } from '../src/modules/plan-analysis/footprint-validation'

const dimensions = { width: 507, height: 370 },
  ring = [
    { x: 0.1, y: 0.15 },
    { x: 0.8, y: 0.15 },
    { x: 0.8, y: 0.9 },
    { x: 0.1, y: 0.9 },
  ]
const raw: Candidate = {
  id: 'cv_edge_24',
  kind: 'wall',
  points: [
    { x: 0.85, y: 0.3 },
    { x: 0.85, y: 0.8 },
  ],
  thickness: 0.004,
  confidence: 0.45,
  evidence: 'Native source line',
  needsReview: true,
  uncertainties: [],
}
const source: Intelligence = {
  coordinatesVersion: 1,
  coordinateSystem: 'normalized-image-top-left',
  candidates: [],
  warnings: [],
  understanding: {
    buildingType: 'house',
    footprint: ring,
    conventions: [],
    circulation: [],
    uncertainties: [],
  },
  dispositions: [
    {
      candidateId: raw.id,
      decision: 'confirm',
      reason: 'Corrected alignment to match the footprint east boundary',
    },
  ],
}

test('a confirmed raw stroke outside the building stays reviewable evidence rather than returning as a margin wall', () => {
  const before = structuredClone(raw),
    measured = classifiedMeasurements([raw], [source], dimensions)
  expect(measured[0].kind).toBe('unknown')
  expect(measured[0].uncertainties.join(' ')).toContain('conflicts')
  expect(
    buildableCandidates(
      reconcile(measured, [source], 'full', { ...dimensions, metresPerPixel: 0.02 }).candidates,
    ),
  ).toEqual([])
  expect(raw).toEqual(before)
})

test('source-supported perimeter and interior measurements are retained', () => {
  for (const x of [0.5, 0.8, 0.802]) {
    const measured = classifiedMeasurements(
      [{ ...raw, points: raw.points.map((point) => ({ ...point, x })) }],
      [source],
      dimensions,
    )
    expect(measured[0].kind).toBe('wall')
  }
})

test('explicit interpreted walls outside the footprint still block reconstruction instead of being silently removed', () => {
  const proposal = { ...source, candidates: [raw] },
    measured = classifiedMeasurements([raw], [proposal], dimensions)
  expect(measured[0].kind).toBe('wall')
  expect(() =>
    validateFootprint(
      proposal,
      buildableCandidates(
        reconcile(measured, [proposal], 'full', { ...dimensions, metresPerPixel: 0.02 }).candidates,
      ),
      dimensions.width,
      dimensions.height,
    ),
  ).toThrow('margins must stay empty')
})

test('a corrected explicit candidate overrides its raw measurement and missing/invalid envelopes cannot suppress evidence', () => {
  const fixed = { ...raw, points: raw.points.map((point) => ({ ...point, x: 0.8 })) },
    proposal = { ...source, candidates: [fixed] }
  const result = reconcile(classifiedMeasurements([raw], [proposal], dimensions), [proposal], 'full', {
    ...dimensions,
    metresPerPixel: 0.02,
  })
  expect(result.candidates[0].points).toEqual(fixed.points)
  expect(classifiedMeasurements([raw], [{ ...source, understanding: undefined }], dimensions)[0].kind).toBe(
    'wall',
  )
  expect(
    classifiedMeasurements(
      [raw],
      [
        {
          ...source,
          understanding: { ...source.understanding!, footprint: [ring[0], ring[2], ring[1], ring[3]] },
        },
      ],
      dimensions,
    )[0].kind,
  ).toBe('wall')
})
