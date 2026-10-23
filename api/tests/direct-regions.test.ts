import { expect, test } from 'bun:test'
import type { Candidate, Intelligence } from '../src/contracts/analysis'
import type { IntelligenceInput } from '../src/modules/ai/provider'
import { readRegions, regionOwner, regionalProposal } from '../src/workers/direct-regions'
const candidate = (id: string, x: number, y: number): Candidate => ({
  id,
  kind: 'wall',
  points: [
    { x: x - 0.01, y },
    { x: x + 0.01, y },
  ],
  confidence: 0.8,
  evidence: 'Wall',
  uncertainties: [],
  needsReview: true,
})
const empty: Intelligence = {
  coordinatesVersion: 1,
  coordinateSystem: 'normalized-image-top-left',
  candidates: [],
  warnings: [],
}
const measured = [
  candidate('cv_wall_0', 0.2, 0.2),
  candidate('cv_wall_1', 0.8, 0.2),
  candidate('cv_wall_2', 0.2, 0.8),
  candidate('cv_wall_3', 0.8, 0.8),
]
const bytes = new Uint8Array([1, 2, 3]),
  details = [0, 1, 2, 3].map((index) => ({
    bytes,
    mime: 'image/png',
    region: { x: (index % 2) * 0.45, y: Math.floor(index / 2) * 0.45, width: 0.55, height: 0.55 },
  }))
const source: IntelligenceInput = {
  bytes,
  mime: 'image/png',
  width: 708,
  height: 551,
  candidates: measured,
  pass: 'global-understanding',
  model: 'fake',
  details,
}
test('dense direct processing starts every region before any finishes and retains source coordinates exactly once', async () => {
  let active = 0,
    maximum = 0
  const seen: string[] = [],
    completed: string[][] = []
  let release!: () => void
  const gate = new Promise<void>((resolve) => (release = resolve))
  const document = { bytes, mime: 'application/pdf' as const, page: 3 }
  const result = await readRegions(
    { ...source, document },
    new AbortController().signal,
    async (input) => {
      expect(input.bytes).toBe(bytes)
      if (input.pass === 'global-understanding') {
        expect(input.document).toBe(document)
        return {
          ...empty,
          understanding: {
            buildingType: 'arena',
            footprint: [],
            conventions: [],
            circulation: [],
            uncertainties: [],
          },
        }
      }
      maximum = Math.max(maximum, ++active)
      seen.push(...input.candidates.map((item) => item.id))
      expect(input.crop?.bytes).toBe(bytes)
      expect(input.understanding?.buildingType).toBe('arena')
      expect(input.document).toBeUndefined()
      if (active === 4) release()
      await gate
      active--
      return { ...empty, candidates: input.candidates }
    },
    async (_pass, done) => {
      completed.push(done)
    },
  )
  expect(maximum).toBe(4)
  expect(seen.sort()).toEqual(measured.map((item) => item.id))
  expect(result.flatMap((item) => item.candidates)).toEqual(measured)
  expect(completed.at(-1)).toHaveLength(5)
})
test('regional identities prevent name collisions and remap opening hosts without duplicating overlapping rooms', () => {
  const wall = candidate('w1', 0.2, 0.2),
    door = { ...wall, id: 'd1', kind: 'door' as const, wallId: 'w1' },
    other = candidate('wrong-region', 0.8, 0.2)
  const proposal = regionalProposal({ ...empty, candidates: [measured[0], wall, door, other] }, 0, [
    measured[0],
  ])
  expect(proposal.candidates.map((item) => item.id)).toEqual(['cv_wall_0', 'region1_w1', 'region1_d1'])
  expect(proposal.candidates[2].wallId).toBe('region1_w1')
  expect(proposal.candidates[0].points).toEqual(measured[0].points)
  expect(measured.map((c) => regionOwner(c))).toEqual([0, 1, 2, 3])
})
test('a failed region cancels its siblings and never returns a partial building as complete', async () => {
  let cancelled = 0
  await expect(
    readRegions(
      source,
      new AbortController().signal,
      async (input, signal) => {
        if (input.pass === 'global-understanding') return empty
        if (input.pass === 'reconstruct-region-1') throw new Error('region failed')
        await new Promise<void>((resolve) => {
          if (signal.aborted) {
            cancelled++
            resolve()
          } else
            signal.addEventListener(
              'abort',
              () => {
                cancelled++
                resolve()
              },
              { once: true },
            )
        })
        signal.throwIfAborted()
        return empty
      },
      async () => {},
    ),
  ).rejects.toThrow('region failed')
  expect(cancelled).toBe(3)
})

test('a selected plan on a sheet owns its four passes without importing the neighbouring drawing', async () => {
  const region = { x: 0.5, y: 0.1, width: 0.45, height: 0.7 }
  const selected = [candidate('right-top', 0.6, 0.2), candidate('right-bottom', 0.85, 0.65)]
  const crops = [0, 1, 2, 3].map((i) => ({
    bytes,
    mime: 'image/png',
    region: {
      x: region.x + (i % 2) * 0.45 * region.width,
      y: region.y + Math.floor(i / 2) * 0.45 * region.height,
      width: 0.55 * region.width,
      height: 0.55 * region.height,
    },
  }))
  const seen: string[] = [],
    result = await readRegions(
      { ...source, candidates: selected, region, details: crops },
      new AbortController().signal,
      async (input) => {
        if (input.pass === 'global-understanding') {
          expect(input.region).toEqual(region)
          return empty
        }
        seen.push(...input.candidates.map((c) => c.id))
        return { ...empty, candidates: [...input.candidates, candidate('other-plan', 0.2, 0.2)] }
      },
      async () => {},
    )
  expect(seen.sort()).toEqual(selected.map((c) => c.id).sort())
  expect(
    result
      .flatMap((p) => p.candidates)
      .map((c) => c.id)
      .sort(),
  ).toEqual(seen)
})
