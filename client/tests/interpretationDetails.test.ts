import { expect, test } from 'bun:test'
import { fixtureProject } from '../src/domain/fixture'
import { connectAdjacentLevels, newSlab } from '../src/domain/levels'
import { connectStairGuide } from '../src/domain/stairGuides'
import { scanPlanDetails } from '../src/workers/planDetails'
import { consolidateWalls } from '../src/workers/consolidateWalls'
import { openingEvidence } from '../src/geometry/openingEvidence'
import {
  findOpeningCandidates,
  type OpeningCandidate,
  type WorldFeature,
} from '../src/geometry/openingCandidates'
import { assembleDraft } from '../src/geometry/reconstruct'
import type { Point, Wall } from '../src/domain/types'

const rect = (x: number, z: number, width: number, depth: number): Point[] => [
  { x, z },
  { x: x + width, z },
  { x: x + width, z: z + depth },
  { x, z: z + depth },
]

test('regular stair treads with rails are preserved while isolated repeated marks are rejected', () => {
  const width = 200,
    height = 200,
    mask = new Uint8Array(width * height)
  for (let y = 40; y <= 80; y++) {
    mask[y * width + 60] = 1
    mask[y * width + 80] = 1
  }
  for (let y = 40; y <= 80; y += 5) for (let x = 60; x <= 80; x++) mask[y * width + x] = 1
  for (let y = 110; y <= 150; y += 5) for (let x = 110; x <= 130; x++) mask[y * width + x] = 1
  const details = scanPlanDetails(mask, [], width, height).filter((detail) => detail.kind === 'stair')
  expect(details).toHaveLength(1)
  expect(details[0].treadCount).toBe(9)
  expect(details[0].polygon[0].x).toBe(60)
})

test('overlapping measurements become one thick wall while physically separate walls stay separate', () => {
  const lines = consolidateWalls([
    { x1: 20, y1: 50, x2: 160, y2: 50, thicknessPixels: 10 },
    { x1: 70, y1: 54, x2: 170, y2: 54, thicknessPixels: 6 },
    { x1: 20, y1: 75, x2: 160, y2: 75, thicknessPixels: 4 },
  ])
  expect(lines).toHaveLength(2)
  const thick = lines.find((line) => line.thicknessPixels > 10)!
  expect(thick.thicknessPixels).toBe(12)
  expect(thick.x1).toBe(20)
  expect(thick.x2).toBe(170)
})

test('door arcs work for perpendicular leaves, double doors and rotated hosts', () => {
  const root2 = Math.sqrt(2),
    unit = { x: 1 / root2, z: 1 / root2 }
  const at = (along: number, across: number) => ({
    x: along * unit.x - across * unit.z,
    z: along * unit.z + across * unit.x,
  })
  const candidate: OpeningCandidate = {
    id: 'gap',
    firstId: 'a',
    secondId: 'b',
    start: at(0, 0),
    end: at(1.8, 0),
    width: 1.8,
    exterior: false,
    choice: 'unknown',
  }
  const features: WorldFeature[] = [
    { kind: 'swing', start: at(0, 0), end: at(0, 0.9) },
    { kind: 'swing', start: at(1.8, 0), end: at(1.8, 0.9) },
  ]
  expect(openingEvidence(candidate, features)).toMatchObject({
    choice: 'door',
    hinge: 'left',
    doubleLeaf: true,
  })
  const wall = (id: string, lo: number, hi: number): Wall => ({
    id,
    start: at(lo, 0),
    end: at(hi, 0),
    thickness: 0.2,
    height: 3,
    material: 'plaster',
  })
  const walls = [wall('a', -3, 0), wall('b', 1.8, 4)]
  const draft = assembleDraft(walls, findOpeningCandidates(walls, features))
  expect(draft.walls).toHaveLength(1)
  expect(draft.doors[0]).toMatchObject({ style: 'double', hinge: 'left' })
  expect(draft.doors[0].offset).toBeCloseTo(3)
  expect(
    openingEvidence(candidate, [{ kind: 'diagonal', start: at(0.4, 0.4), end: at(0.8, 0.8) }]).choice,
  ).toBe('unknown')
})

test('connecting a stair stays inside its measured guide and creates a matching upper opening', () => {
  const project = fixtureProject(),
    levels = project.buildings[0].levels,
    ground = levels[0]
  ground.walls = []
  ground.doors = []
  ground.windows = []
  ground.rooms = []
  ground.stairGuides = [
    { id: 'guide', polygon: rect(2, 2, 1.1, 6), treadCount: 18, evidence: 'Measured treads' },
  ]
  const upper = {
    ...structuredClone(ground),
    id: 'upper',
    elevation: 3,
    stairGuides: [],
    slabs: [newSlab(rect(0, 0, 20, 20))],
  }
  levels.push(upper)
  expect(connectStairGuide(project, ground.id, 'guide', upper.id, 'straight', false)).toBeNull()
  expect(ground.stairs).toHaveLength(1)
  expect(ground.stairs![0]).toMatchObject({ start: { x: 2.55, z: 2 }, direction: 90, guideId: 'guide' })
  expect(upper.slabs[0].openings[0].id).toBe(ground.stairs![0].openingId!)
  expect(connectStairGuide(project, ground.id, 'guide', upper.id, 'straight', false)).toContain(
    'already connected',
  )
  ground.stairGuides.push({ id: 'short', polygon: rect(8, 8, 1.1, 2), evidence: 'Partial flight' })
  expect(connectStairGuide(project, ground.id, 'short', upper.id, 'straight', false)).toContain(
    'does not fit',
  )
  expect(ground.stairs).toHaveLength(1)
  expect(upper.slabs[0].openings).toHaveLength(1)
  ground.stairs = []
  upper.slabs[0].openings = []
  ground.stairGuides = ground.stairGuides.filter((guide) => guide.id === 'short')
  connectAdjacentLevels(project)
  expect(ground.stairs).toHaveLength(0)
  expect(upper.slabs[0].openings).toHaveLength(0)
})

test('perpendicular thin door leaves classify without arcs while detached strokes remain unresolved', () => {
  const gap: OpeningCandidate = {
    id: 'leaf-gap',
    firstId: 'a',
    secondId: 'b',
    start: { x: 0, z: 0 },
    end: { x: 0.9, z: 0 },
    width: 0.9,
    exterior: false,
    choice: 'unknown',
  }
  expect(
    openingEvidence(gap, [{ kind: 'axis', start: { x: 0.9, z: 0 }, end: { x: 0.9, z: -0.9 } }]),
  ).toMatchObject({ choice: 'door', hinge: 'right' })
  expect(
    openingEvidence(gap, [{ kind: 'axis', start: { x: 0.4, z: 0 }, end: { x: 0.4, z: 0.9 } }]).choice,
  ).toBe('unknown')
  expect(
    openingEvidence(gap, [{ kind: 'axis', start: { x: 0, z: 0.4 }, end: { x: 0, z: 1.3 } }]).choice,
  ).toBe('unknown')
})

test('glazing requires distinct spanning strokes rather than duplicate traces or dimension lines', () => {
  const gap: OpeningCandidate = {
    id: 'window-gap',
    firstId: 'a',
    secondId: 'b',
    start: { x: 0, z: 0 },
    end: { x: 1.4, z: 0 },
    width: 1.4,
    exterior: true,
    choice: 'unknown',
  }
  const pane: WorldFeature = { kind: 'axis', start: { x: 0, z: -0.04 }, end: { x: 1.4, z: -0.04 } }
  expect(openingEvidence(gap, [pane, pane]).choice).toBe('unknown')
  expect(
    openingEvidence(gap, [pane, { kind: 'axis', start: { x: 0, z: 0.04 }, end: { x: 1.4, z: 0.04 } }]).choice,
  ).toBe('window')
  expect(
    openingEvidence(
      gap,
      [-0.04, 0.04].map((z) => ({ kind: 'axis', start: { x: -3, z }, end: { x: 4, z } })),
    ).choice,
  ).toBe('unknown')
})
