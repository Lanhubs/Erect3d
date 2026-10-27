import { expect, test } from 'bun:test'
import { reconcile } from '../src/modules/ai/reconcile'
import { alignOpeningHosts } from '../src/workers/opening-hosts'
import type { Candidate, Intelligence } from '../src/contracts/analysis'
const base = { confidence: 0.9, evidence: 'Drawn source', uncertainties: [], needsReview: true as const }
const wall: Candidate = {
  ...base,
  id: 'host',
  kind: 'wall',
  thickness: 0.01,
  points: [
    { x: 0.3, y: 0.3 },
    { x: 0.4, y: 0.3 },
  ],
}
const window: Candidate = {
  ...base,
  id: 'window',
  kind: 'window',
  wallId: wall.id,
  points: [
    { x: 0.32, y: 0.3 },
    { x: 0.38, y: 0.3 },
  ],
}
const proposal = (candidates: Candidate[]): Intelligence => ({
  coordinatesVersion: 1,
  coordinateSystem: 'normalized-image-top-left',
  warnings: [],
  candidates,
})
test('minor along-wall jamb rounding snaps within existing stroke thickness but cannot shorten a gap substantially', () => {
  const result = alignOpeningHosts(
    proposal([
      wall,
      {
        ...window,
        points: [
          { x: 0.296, y: 0.3 },
          { x: 0.35, y: 0.3 },
        ],
      },
    ]),
    1000,
    800,
  )
  expect(result.candidates[1].points[0].x).toBe(0.3)
  for (const start of [0.28, 0.295]) {
    const points = [
      { x: start, y: 0.3 },
      { x: 0.305, y: 0.3 },
    ]
    expect(
      alignOpeningHosts(proposal([wall, { ...window, points }]), 1000, 800).candidates[1].points,
    ).toEqual(points)
  }
})
test('a rejected false host can reattach its opening to a real replacement before orphan evidence is quarantined', () => {
  const original = proposal([wall, window]),
    patch = {
      ...proposal([{ ...wall, id: 'replacement' }]),
      dispositions: [
        {
          candidateId: wall.id,
          decision: 'reject' as const,
          reason: 'False thick band replaced by precise wall',
        },
      ],
    }
  const result = alignOpeningHosts(reconcile([], [original, patch], 'full'), 1000, 800)
  expect(result.candidates.find((candidate) => candidate.id === window.id)).toMatchObject({
    kind: 'window',
    wallId: 'replacement',
  })
  const orphan = alignOpeningHosts(reconcile([], [original, { ...patch, candidates: [] }], 'full'), 1000, 800)
  expect(orphan.candidates[0]).toMatchObject({ id: window.id, kind: 'unknown', needsReview: true })
  expect(orphan.warnings.join(' ')).toContain('not erected without a host')
  expect(original.candidates[1].kind).toBe('window')
})
test('a missing unexplained host or a saved opening is never silently dropped', () => {
  const missing = alignOpeningHosts(reconcile([], [proposal([window])], 'full'), 1000, 800)
  expect(missing.candidates[0].kind).toBe('window')
  const saved = alignOpeningHosts(
    reconcile(
      [],
      [
        proposal([{ ...window, targetId: 'saved-window' }]),
        {
          ...proposal([]),
          dispositions: [{ candidateId: wall.id, decision: 'reject', reason: 'False host' }],
        },
      ],
      'full',
    ),
    1000,
    800,
  )
  expect(saved.candidates[0]).toMatchObject({ kind: 'window', targetId: 'saved-window' })
})
test('an implausibly wide native band cannot absorb a separate thin partition or pull an opening across the room', () => {
  const band = {
    ...wall,
    id: 'cv_wall_9',
    thickness: 0.06,
    points: [
      { x: 0.1, y: 0.5 },
      { x: 0.9, y: 0.5 },
    ],
  }
  const partition = {
    ...wall,
    id: 'partition',
    points: [
      { x: 0.3, y: 0.52 },
      { x: 0.5, y: 0.52 },
    ],
  }
  const source = proposal([
    band,
    partition,
    {
      ...window,
      wallId: partition.id,
      points: [
        { x: 0.32, y: 0.5 },
        { x: 0.38, y: 0.5 },
      ],
    },
  ])
  source.understanding = {
    buildingType: 'house',
    footprint: [],
    conventions: [],
    circulation: [],
    uncertainties: [],
    scale: {
      a: { x: 0, y: 0 },
      b: { x: 1, y: 0 },
      knownMetres: 50,
      origin: 'annotated',
      evidence: '50 m overall',
    },
  }
  const reconciled = reconcile([], [source], 'full', { width: 1000, height: 800, metresPerPixel: 0.05 })
  expect(reconciled.candidates.filter((candidate) => candidate.kind === 'wall')).toHaveLength(2)
  const result = alignOpeningHosts(reconciled, 1000, 800)
  expect(result.candidates.find((candidate) => candidate.id === 'window')?.wallId).toBe(partition.id)
})
