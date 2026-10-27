import { expect, test } from 'bun:test'
import { fitSourceRooms } from '../src/workers/source-rooms'
import { validateFootprint } from '../src/modules/plan-analysis/footprint-validation'
import type { Candidate, Intelligence } from '../src/contracts/analysis'
const ring = [
  { x: 0.1, y: 0.1 },
  { x: 0.9, y: 0.1 },
  { x: 0.9, y: 0.8 },
  { x: 0.85, y: 0.8 },
  { x: 0.85, y: 0.9 },
  { x: 0.1, y: 0.9 },
]
const room: Candidate = {
  id: 'guest',
  kind: 'room',
  label: 'Guest suite',
  confidence: 0.9,
  needsReview: true,
  evidence: 'Source room',
  uncertainties: [],
  points: [
    { x: 0.6, y: 0.6 },
    { x: 0.9, y: 0.6 },
    { x: 0.9, y: 0.9 },
    { x: 0.6, y: 0.9 },
  ],
}
const proposal = (): Intelligence => ({
  coordinatesVersion: 1,
  coordinateSystem: 'normalized-image-top-left',
  warnings: [],
  candidates: [structuredClone(room)],
  understanding: {
    buildingType: 'villa',
    footprint: ring,
    conventions: [],
    circulation: [],
    uncertainties: [],
  },
})
test('a small rectangle corner follows an ink-supported facade step without filling the exterior notch', () => {
  const original = proposal(),
    before = structuredClone(original)
  const result = fitSourceRooms(original, 1000, 800, () => true)
  expect(result.candidates[0].points).toHaveLength(6)
  expect(result.candidates[0].uncertainties.join(' ')).toContain('stepped')
  expect(() => validateFootprint(result, result.candidates, 1000, 800)).not.toThrow()
  expect(original).toEqual(before)
})
test('room fitting refuses unsupported outlines, major cuts, outdoor spaces and manual targets', () => {
  expect(fitSourceRooms(proposal(), 1000, 800, () => false).candidates[0].points).toEqual(room.points)
  for (const change of [{ label: 'Courtyard' }, { targetId: 'saved-room' }, { confidence: 0.4 }]) {
    const original = proposal()
    Object.assign(original.candidates[0], change)
    expect(fitSourceRooms(original, 1000, 800, () => true)).toBe(original)
  }
  const major = proposal()
  major.candidates[0].points = [
    { x: 0.85, y: 0.75 },
    { x: 0.99, y: 0.75 },
    { x: 0.99, y: 0.99 },
    { x: 0.85, y: 0.99 },
  ]
  expect(fitSourceRooms(major, 1000, 800, () => true)).toBe(major)
})
