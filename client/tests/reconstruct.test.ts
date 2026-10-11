import { expect, test } from 'bun:test'
import type { Wall } from '../src/domain/types'
import { findOpeningCandidates, type WorldFeature } from '../src/geometry/openingCandidates'
import { assembleDraft } from '../src/geometry/reconstruct'

const line = (id: string, x1: number, z1: number, x2: number, z2: number): Wall => ({
  id, start: { x: x1, z: z1 }, end: { x: x2, z: z2 }, thickness: .2, height: 2.9, material: 'plaster',
})
const walls = [line('north-a', 0, 0, 3, 0), line('north-b', 4.2, 0, 8, 0),
  line('interior-a', 0, 4, 3, 4), line('interior-b', 3.9, 4, 8, 4), line('south', 0, 8, 8, 8)]
const features: WorldFeature[] = [
  { start: { x: 3.1, z: -.05 }, end: { x: 4.1, z: -.05 }, kind: 'axis' },
  { start: { x: 3.1, z: .05 }, end: { x: 4.1, z: .05 }, kind: 'axis' },
  { start: { x: 3.04, z: 4 }, end: { x: 3.65, z: 4.61 }, kind: 'diagonal' },
]

test('thin window lines and a jamb anchored diagonal classify gaps before construction', () => {
  const proposals = findOpeningCandidates(walls, features)
  expect(proposals).toHaveLength(2)
  expect(proposals.find(item => item.exterior)?.choice).toBe('window')
  expect(proposals.find(item => !item.exterior)?.choice).toBe('door')
  const result = assembleDraft(walls, proposals)
  expect(result.walls).toHaveLength(3)
  expect(result.windows[0].wallId).toBe('north-a')
  expect(result.windows[0].width).toBeCloseTo(1.2)
  expect(result.doors[0].wallId).toBe('interior-a')
  expect(result.doors[0].width).toBeCloseTo(.9)
})

test('unexplained exterior gaps remain Needs Review, never automatic entrances', () => {
  const proposals = findOpeningCandidates(walls)
  expect(proposals.every(item => item.choice === 'unknown')).toBe(true)
  const result = assembleDraft(walls, proposals)
  expect(result.walls).toHaveLength(5)
  expect(result.doors).toHaveLength(0)
  expect(result.windows).toHaveLength(0)
})

test('user reclassification creates a hosted open passage or closes the gap', () => {
  const proposals = findOpeningCandidates(walls)
  const interior = proposals.find(item => !item.exterior)!
  const passage = assembleDraft(walls, [{ ...interior, choice: 'passage' }])
  expect(passage.passages).toHaveLength(1)
  expect(passage.passages[0].offset).toBeCloseTo(3)
  const closed = assembleDraft(walls, [{ ...interior, choice: 'wall' }])
  expect(closed.walls).toHaveLength(4)
  expect(closed.passages).toHaveLength(0)
})

test('large gaps and separate parallel walls are not joined', () => {
  const items = [line('a', 0, 0, 2, 0), line('b', 5.5, 0, 8, 0), line('c', 0, .5, 2, .5)]
  expect(findOpeningCandidates(items)).toHaveLength(0)
  expect(assembleDraft(items).walls).toHaveLength(3)
})
