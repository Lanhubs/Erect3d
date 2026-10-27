import { expect, test } from 'bun:test'
import { anchorRoomScale } from '../src/modules/plan-analysis/room-scale'
import { classifyStrokes } from '../src/modules/ai/stroke-classification'
import { compactReconstructionSchema } from '../src/modules/ai/compact-reconstruction'
import { uncrossSourceRing } from '../src/workers/source-rings'
import { validRing } from '../src/modules/plan-analysis/footprint-validation'
import type { Intelligence } from '../src/contracts/analysis'

test('dense wall reference lists classify all measurements without shifting IDs or requiring character counts', () => {
  const result = classifyStrokes(
    { classification: 'wall-refs-v1', wallRefs: [0, 24, 25, 50, 149], uncertainWallRefs: [91] },
    150,
  )
  expect(result.labels).toHaveLength(150)
  expect(result.selected).toEqual([0, 24, 25, 50, 149])
  expect(result.labels[91]).toBe('2')
  expect(result.labels[92]).toBe('0')
  expect(() => classifyStrokes({ classification: 'wall-refs-v1', wallRefs: [150] }, 150)).toThrow(
    'Unknown measured wall',
  )
  expect(() =>
    classifyStrokes({ classification: 'wall-refs-v1', wallRefs: [2], uncertainWallRefs: [2] }, 10),
  ).toThrow('both confirmed and uncertain')
  expect(() => classifyStrokes({ strokeLabels: { 0: '111' } }, 25)).toThrow('Every source measurement')
  const wire: any = compactReconstructionSchema(150)
  expect(wire.properties.strokeLabels).toBeUndefined()
  expect(wire.required).toContain('wallRefs')
  expect(wire.required).toContain('uncertainWallRefs')
})
function roomProposal(): Intelligence {
  return {
    coordinatesVersion: 1,
    coordinateSystem: 'normalized-image-top-left',
    warnings: [],
    candidates: [
      {
        id: 'suite',
        kind: 'room',
        label: 'Guest Suite #2',
        confidence: 0.9,
        needsReview: true,
        evidence: 'Source room faces',
        uncertainties: [],
        points: [
          { x: 0.2, y: 0.2 },
          { x: 0.8, y: 0.2 },
          { x: 0.8, y: 0.8 },
          { x: 0.2, y: 0.8 },
        ],
      },
    ],
    understanding: {
      buildingType: 'villa',
      footprint: [],
      circulation: [],
      conventions: [],
      uncertainties: [],
      scale: {
        a: { x: 0.4, y: 0.5 },
        b: { x: 0.6, y: 0.5 },
        knownMetres: 6,
        origin: 'annotated',
        evidence: 'Guest Suite #2: printed 6 m room width',
      },
    },
  }
}
test('a named printed room dimension uses opposite room faces, preserving the original and recording correction', () => {
  const original = roomProposal(),
    before = structuredClone(original)
  const corrected = anchorRoomScale(original, 1000, 700)
  expect(corrected.understanding?.scale).toMatchObject({
    a: { x: 0.2, y: 0.5 },
    b: { x: 0.8, y: 0.5 },
    knownMetres: 6,
  })
  expect(corrected.warnings[0]).toContain('Review this scale')
  expect(original).toEqual(before)
  expect(anchorRoomScale(corrected, 1000, 700)).toBe(corrected)
})
test('plot references, ambiguous room names and inferred dimensions are never stretched to a room', () => {
  for (const change of [{ evidence: 'Plot overall 6 metres' }, { origin: 'inferred' as const }]) {
    const proposal = roomProposal()
    Object.assign(proposal.understanding!.scale!, change)
    expect(anchorRoomScale(proposal, 1000, 700)).toBe(proposal)
  }
  const duplicate = roomProposal()
  duplicate.candidates.push({ ...duplicate.candidates[0], id: 'second-suite' })
  expect(anchorRoomScale(duplicate, 1000, 700)).toBe(duplicate)
})
test('crossed contour correction requires actual edge evidence and never changes a valid courtyard notch', () => {
  const crossed = [
    { x: 10, z: 10 },
    { x: 90, z: 90 },
    { x: 90, z: 10 },
    { x: 10, z: 90 },
  ]
  expect(uncrossSourceRing(crossed, () => false)).toBe(crossed)
  const corrected = uncrossSourceRing(crossed, (a, b) => a.x === b.x || a.z === b.z)
  expect(validRing(corrected)).toBe(true)
  expect([...corrected].sort((a, b) => a.x - b.x || a.z - b.z)).toEqual(
    [...crossed].sort((a, b) => a.x - b.x || a.z - b.z),
  )
  const notch = [
    { x: 0, z: 0 },
    { x: 10, z: 0 },
    { x: 10, z: 10 },
    { x: 6, z: 10 },
    { x: 6, z: 4 },
    { x: 4, z: 4 },
    { x: 4, z: 10 },
    { x: 0, z: 10 },
  ]
  expect(uncrossSourceRing(notch, () => true)).toBe(notch)
})
