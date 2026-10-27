import { expect, test } from 'bun:test'
import { joinSourceWallEnds } from '../src/workers/wall-junctions'
import type { Intelligence } from '../src/contracts/analysis'
const proposal = (): Intelligence => ({
  coordinatesVersion: 1,
  coordinateSystem: 'normalized-image-top-left',
  warnings: [],
  understanding: {
    buildingType: 'house',
    footprint: [
      { x: 0.1, y: 0.1 },
      { x: 0.5, y: 0.1 },
      { x: 0.5, y: 0.9 },
      { x: 0.1, y: 0.9 },
    ],
    conventions: [],
    circulation: [],
    uncertainties: [],
  },
  candidates: [
    {
      id: 'return',
      kind: 'wall',
      confidence: 0.9,
      points: [
        { x: 0.5, y: 0.1 },
        { x: 0.5, y: 0.8 },
      ],
      thickness: 0.01,
      evidence: 'Source wall',
      uncertainties: [],
      needsReview: true,
    },
    {
      id: 'partition',
      kind: 'wall',
      confidence: 0.9,
      points: [
        { x: 0.4, y: 0.3 },
        { x: 0.51, y: 0.3 },
      ],
      thickness: 0.01,
      evidence: 'Source wall',
      uncertainties: [],
      needsReview: true,
    },
  ],
})
test('small source-supported wall overruns join the actual perpendicular host without extending into margins', () => {
  const source = proposal(),
    before = structuredClone(source)
  expect(joinSourceWallEnds(source, 1000, 800, () => true).candidates[1].points[1].x).toBe(0.5)
  expect(source).toEqual(before)
  expect(joinSourceWallEnds(source, 1000, 800, () => false).candidates[1].points[1].x).toBe(0.51)
  source.candidates[1].targetId = 'saved-partition'
  expect(joinSourceWallEnds(source, 1000, 800, () => true).candidates[1].points[1].x).toBe(0.51)
  delete source.candidates[1].targetId
  source.candidates[1].points[1].x = 0.6
  expect(joinSourceWallEnds(source, 1000, 800, () => true).candidates[1].points[1].x).toBe(0.6)
})
