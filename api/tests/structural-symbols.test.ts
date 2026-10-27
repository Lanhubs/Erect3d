import { expect, test } from 'bun:test'
import type { Candidate, Intelligence } from '../src/contracts/analysis'
import { classifiedMeasurements } from '../src/workers/source-measurements'
import { expandReconstruction } from '../src/modules/ai/compact-reconstruction'
import { validateFootprint } from '../src/modules/plan-analysis/footprint-validation'

const ring = [
  { x: 0.2, y: 0.2 },
  { x: 0.6, y: 0.2 },
  { x: 0.6, y: 0.6 },
  { x: 0.2, y: 0.6 },
]
const symbol: Candidate = {
  id: 'cv_detail_0',
  kind: 'stair',
  points: ring,
  confidence: 0.75,
  evidence: 'Repeated line pattern, awaiting interpretation',
  uncertainties: [],
  needsReview: true,
}
const compact = {
  buildingType: 'house',
  footprint: ring.map((point) => [point.x, point.y]),
  classification: 'wall-refs-v1',
  wallRefs: [],
  uncertainWallRefs: [],
  walls: [],
  openings: [],
  rooms: [],
  columns: [],
  stairs: [],
  fixtures: [],
  warnings: [],
}
test('unconfirmed hatch-like stair and column symbols remain evidence and cannot erect random geometry', () => {
  const column = { ...symbol, id: 'cv_detail_1', kind: 'column' as const }
  const result = classifiedMeasurements([symbol, column], [])
  expect(result.map((candidate) => candidate.kind)).toEqual(['unknown', 'unknown'])
  expect(symbol.kind).toBe('stair')
  const approved = expandReconstruction({ ...compact, detailRefs: [symbol.id] }, [symbol, column])
  expect(approved.candidates).toHaveLength(1)
  expect(approved.candidates[0]).toMatchObject({ id: symbol.id, kind: 'stair', points: ring })
  expect(classifiedMeasurements([symbol, column], [approved]).map((candidate) => candidate.kind)).toEqual([
    'stair',
    'unknown',
  ])
  expect(() => expandReconstruction({ ...compact, detailRefs: ['invented_symbol'] }, [symbol])).toThrow(
    'Unknown structural symbol',
  )
})
test('posts touching a real owned deck edge are allowed while unrelated site columns and outdoor furniture are rejected', () => {
  const platform = [
    { x: 0.6, y: 0.2 },
    { x: 0.8, y: 0.2 },
    { x: 0.8, y: 0.6 },
    { x: 0.6, y: 0.6 },
  ]
  const proposal: Intelligence = {
    coordinatesVersion: 1,
    coordinateSystem: 'normalized-image-top-left',
    candidates: [{ ...symbol, id: 'deck-boundary', kind: 'architectural-boundary', points: platform }],
    warnings: [],
    understanding: {
      buildingType: 'house',
      footprint: ring,
      conventions: [],
      circulation: [],
      uncertainties: [],
    },
    architecturalRequirements: {
      typology: 'house',
      systems: [
        {
          id: 'deck',
          name: 'Rear deck',
          kind: 'articulation',
          profile: 'balcony',
          boundaryId: 'deck-boundary',
          origin: 'detected',
          evidence: 'Source deck and posts',
          parameters: { height: 1.1, thickness: 0.2, depth: 2, spacing: 1 },
        },
      ],
    },
  }
  const post: Candidate = {
    ...symbol,
    kind: 'column',
    points: [
      { x: 0.79, y: 0.4 },
      { x: 0.81, y: 0.4 },
      { x: 0.81, y: 0.42 },
      { x: 0.79, y: 0.42 },
    ],
  }
  expect(() => validateFootprint(proposal, [post], 1000, 800)).not.toThrow()
  const detached = { ...post, points: post.points.map((point) => ({ x: point.x + 0.1, y: point.y })) }
  expect(() => validateFootprint(proposal, [detached], 1000, 800)).toThrow(
    'outside the drawn building footprint',
  )
  expect(() =>
    validateFootprint(proposal, [{ ...post, kind: 'furniture', furnitureType: 'sofa' }], 1000, 800),
  ).toThrow('outside the drawn building footprint')
})
