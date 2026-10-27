import { expect, test } from 'bun:test'
import { clipNativeWalls } from '../src/workers/clip-native-walls'
import { alignOpeningHosts } from '../src/workers/opening-hosts'
import { validateFootprint } from '../src/modules/plan-analysis/footprint-validation'
import type { Candidate, Intelligence } from '../src/contracts/analysis'
const outline = [
  { x: 0.1, y: 0.1 },
  { x: 0.9, y: 0.1 },
  { x: 0.9, y: 0.9 },
  { x: 0.6, y: 0.9 },
  { x: 0.6, y: 0.4 },
  { x: 0.4, y: 0.4 },
  { x: 0.4, y: 0.9 },
  { x: 0.1, y: 0.9 },
]
const wall: Candidate = {
  id: 'cv_wall_1',
  kind: 'wall',
  points: [
    { x: 0.1, y: 0.7 },
    { x: 0.9, y: 0.7 },
  ],
  thickness: 0.004,
  evidence: 'Native source stroke classified as a building wall in the complete-plan interpretation.',
  confidence: 0.8,
  needsReview: true,
  uncertainties: [],
}
const proposal = (): Intelligence => ({
  coordinatesVersion: 1,
  coordinateSystem: 'normalized-image-top-left',
  candidates: [structuredClone(wall)],
  warnings: [],
  understanding: {
    buildingType: 'villa',
    footprint: outline,
    conventions: [],
    circulation: [],
    uncertainties: [],
  },
})
test('a native span crossing an open courtyard keeps exact disjoint indoor portions and relocates hosts correctly', () => {
  const source = proposal(),
    before = structuredClone(source)
  source.candidates.push({
    ...wall,
    id: 'window',
    kind: 'window',
    wallId: wall.id,
    points: [
      { x: 0.7, y: 0.7 },
      { x: 0.8, y: 0.7 },
    ],
  })
  const result = alignOpeningHosts(clipNativeWalls(source, 1000, 800), 1000, 800)
  const walls = result.candidates.filter((candidate) => candidate.kind === 'wall')
  expect(walls).toHaveLength(2)
  expect(walls[0].points).toEqual([
    { x: 0.1, y: 0.7 },
    { x: 0.4, y: 0.7 },
  ])
  expect(walls[1].points[0].x).toBeCloseTo(0.6)
  expect(walls[1].points[1].x).toBeCloseTo(0.9)
  expect(result.candidates.find((candidate) => candidate.id === 'window')?.wallId).toBe(walls[1].id)
  expect(() => validateFootprint(result, result.candidates, 1000, 800)).not.toThrow()
  expect(source.candidates[0]).toEqual(before.candidates[0])
})
test('explicit AI walls and existing manual targets remain blocked rather than being silently clipped', () => {
  for (const properties of [{ evidence: 'Explicit interpreted return wall' }, { targetId: 'saved-wall' }]) {
    const source = proposal()
    Object.assign(source.candidates[0], properties)
    expect(clipNativeWalls(source, 1000, 800)).toBe(source)
    expect(() => validateFootprint(source, source.candidates, 1000, 800)).toThrow(
      'outside the drawn building footprint',
    )
  }
})
test('all-outdoor native bands stay reviewable evidence; malformed outlines and rooms are not excused', () => {
  const source = proposal()
  source.candidates[0].points = [
    { x: 0.95, y: 0.2 },
    { x: 0.95, y: 0.8 },
  ]
  expect(clipNativeWalls(source, 1000, 800).candidates[0].kind).toBe('unknown')
  const invalid = proposal()
  invalid.understanding!.footprint = [outline[0], outline[2], outline[1], outline[3]]
  expect(clipNativeWalls(invalid, 1000, 800)).toBe(invalid)
  const room: Candidate = {
    ...wall,
    id: 'wrong-room',
    kind: 'room',
    points: [
      { x: 0.4, y: 0.4 },
      { x: 0.6, y: 0.4 },
      { x: 0.6, y: 0.9 },
      { x: 0.4, y: 0.9 },
    ],
  }
  const checked = clipNativeWalls({ ...proposal(), candidates: [wall, room] }, 1000, 800)
  expect(() => validateFootprint(checked, checked.candidates, 1000, 800)).toThrow(
    'outside the drawn building footprint',
  )
})
