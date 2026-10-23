import { expect, test } from 'bun:test'
import type { Candidate, Intelligence } from '../src/contracts/analysis'
import { alignOpeningHosts } from '../src/workers/opening-hosts'
const base = {
  confidence: 0.9,
  evidence: 'Visible source wall',
  uncertainties: [],
  needsReview: true as const,
}
const wall = (id: string, a: number, b: number, y = 0.4): Candidate => ({
  ...base,
  id,
  kind: 'wall',
  points: [
    { x: a, y },
    { x: b, y },
  ],
  thickness: 0.003,
})
const model = (candidates: Candidate[]): Intelligence => ({
  coordinatesVersion: 1,
  coordinateSystem: 'normalized-image-top-left',
  warnings: [],
  candidates,
})
const opening: Candidate = {
  ...base,
  id: 'door',
  kind: 'door',
  wallId: 'left',
  points: [
    { x: 0.4, y: 0.4 },
    { x: 0.5, y: 0.4 },
  ],
}
test('two source fragments flanking a semantic opening become one continuous editable host', () => {
  const source = model([
      wall('left', 0.1, 0.4),
      wall('right', 0.5, 0.9),
      opening,
      {
        ...opening,
        id: 'window',
        kind: 'window',
        wallId: 'right',
        points: [
          { x: 0.7, y: 0.4 },
          { x: 0.8, y: 0.4 },
        ],
      },
    ]),
    before = structuredClone(source)
  const result = alignOpeningHosts(source, 1000, 800),
    hosts = result.candidates.filter((c) => c.kind === 'wall')
  expect(hosts).toHaveLength(1)
  expect(hosts[0].points).toEqual([
    { x: 0.1, y: 0.4 },
    { x: 0.9, y: 0.4 },
  ])
  expect(result.candidates.filter((c) => c.wallId).every((c) => c.wallId === hosts[0].id)).toBe(true)
  expect(source).toEqual(before)
})
test('a lone fragment or separate parallel band cannot fabricate an opening host', () => {
  const lone = alignOpeningHosts(model([wall('left', 0.1, 0.4), opening]), 1000, 800)
  expect(lone.candidates.filter((c) => c.kind === 'wall')[0].points[1].x).toBe(0.4)
  const separate = alignOpeningHosts(
    model([wall('left', 0.1, 0.4), wall('other', 0.5, 0.9, 0.43), opening]),
    1000,
    800,
  )
  expect(separate.candidates.filter((c) => c.kind === 'wall')).toHaveLength(2)
})
