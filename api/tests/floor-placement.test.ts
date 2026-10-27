import { expect, test } from 'bun:test'
import { fixture } from './helpers'
import { duplicateLevel } from '../../client/src/domain/levels'
import { reconstructionPlacement } from '../src/modules/plan-analysis/floor-placement'
import type { AnalysisInput, Intelligence } from '../src/contracts/analysis'
function setup() {
  const project = fixture(),
    building = project.buildings[0],
    lower = building.levels[0]
  lower.sourceId = 'lower-source'
  const upper = duplicateLevel(lower, 'Second floor', 3.2)
  upper.sourceId = 'upper-source'
  building.levels.push(upper)
  building.systems = {
    version: 1,
    typology: 'villa',
    systems: [
      {
        id: 'lower-stair',
        name: 'Main circular stair',
        kind: 'spiral-stair',
        levelId: lower.id,
        origin: 'detected',
        evidence: 'Drawn circular stair',
        color: '#888888',
        visible: true,
        elevation: 0,
        center: { x: 10, z: 20 },
        radius: 1,
        width: 0.7,
        height: 3.2,
        riserHeight: 0.178,
        turnHeight: 3.2,
        rotation: 0,
        clockwise: true,
        material: 'concrete',
      },
    ],
  }
  const input: AnalysisInput = {
    sourceAssetId: 'asset',
    sourceId: upper.sourceId,
    levelId: upper.id,
    calibration: {
      a: { x: 0, z: 0 },
      b: { x: 1000, z: 0 },
      knownMetres: 10,
      metresPerPixel: 0.01,
      method: 'auto',
    },
    options: { mode: 'full', engine: 'backend', purpose: 'rebuild', cloudConsent: true, complex: false },
    deterministicCandidates: [],
  }
  const proposal: Intelligence = {
    coordinatesVersion: 1,
    coordinateSystem: 'normalized-image-top-left',
    warnings: [],
    candidates: [
      {
        id: 'stair-boundary',
        kind: 'architectural-boundary',
        confidence: 0.9,
        needsReview: true,
        evidence: 'Source circle',
        uncertainties: [],
        points: [
          { x: 0.45, y: 0.3 },
          { x: 0.55, y: 0.3 },
        ],
        curve: { center: { x: 0.5, y: 0.3 }, radius: 0.05, startAngle: Math.PI, endAngle: 0 },
      },
    ],
    understanding: {
      buildingType: 'villa',
      footprint: [],
      conventions: [],
      circulation: [],
      uncertainties: [],
      scale: {
        a: { x: 0.1, y: 0.1 },
        b: { x: 0.6, y: 0.1 },
        knownMetres: 10,
        origin: 'annotated',
        evidence: '10 metre dimension',
      },
    },
    architecturalRequirements: {
      typology: 'villa',
      systems: [
        {
          id: 'source-stair',
          name: 'Main circular stair',
          kind: 'spiral-stair',
          origin: 'detected',
          evidence: 'Drawn stair core',
          boundaryId: 'stair-boundary',
          parameters: { height: 3.2, radius: 1, width: 0.7, riserHeight: 0.178, turnHeight: 3.2 },
        },
      ],
    },
  }
  return { project, building, lower, upper, input, proposal }
}
test('different image origins align a unique vertical circulation anchor without moving the reference floor or changing scale', () => {
  const { project, input, proposal } = setup(),
    before = structuredClone(project)
  const result = reconstructionPlacement(project, input, proposal, { width: 1000, height: 800 })
  const cal = result.input.calibration
  expect((500 - cal.a.x) * cal.metresPerPixel).toBeCloseTo(10)
  expect((240 - cal.a.z) * cal.metresPerPixel).toBeCloseTo(20)
  expect(cal.metresPerPixel).toBe(0.02)
  expect(result.note).toContain('aligned')
  expect(project).toEqual(before)
})
test('manual scale, explicit offsets and ambiguous or unrelated cores never get automatic placement', () => {
  const dimensions = { width: 1000, height: 800 }
  for (const mode of ['manual', 'offset', 'ambiguous', 'same-source', 'unrelated']) {
    const s = setup()
    if (mode === 'manual') s.input.calibration.method = 'manual'
    if (mode === 'offset') s.input.alignment = { x: 0, z: 0 }
    if (mode === 'ambiguous')
      s.building.systems!.systems.push({ ...s.building.systems!.systems[0], id: 'another-stair' })
    if (mode === 'same-source') s.lower.sourceId = s.upper.sourceId
    if (mode === 'unrelated') s.lower.walls = []
    const result = reconstructionPlacement(s.project, s.input, s.proposal, dimensions)
    expect(result.note).toBeUndefined()
    expect(result.input.calibration.a).toEqual({ x: 0, z: 0 })
  }
})

test('a lift match cannot conceal a contradictory independently identified stair core', () => {
  const s = setup()
  s.building.systems!.systems.push({
    id: 'lower-lift',
    name: 'Elevator',
    kind: 'shaft',
    levelId: s.lower.id,
    origin: 'detected',
    evidence: 'Drawn lift',
    color: '#888888',
    visible: true,
    elevation: 0,
    polygon: [
      { x: 13, z: 19 },
      { x: 15, z: 19 },
      { x: 15, z: 21 },
      { x: 13, z: 21 },
    ],
    height: 3.2,
    thickness: 0.2,
  })
  s.proposal.architecturalRequirements!.systems.push({
    id: 'upper-lift',
    name: 'Elevator',
    kind: 'shaft',
    origin: 'detected',
    evidence: 'Drawn lift',
    boundaryId: 'lift-boundary',
    parameters: { height: 3.2 },
  })
  const lift = {
    ...s.proposal.candidates[0],
    id: 'lift-boundary',
    curve: undefined,
    points: [
      { x: 0.65, y: 0.25 },
      { x: 0.75, y: 0.25 },
      { x: 0.75, y: 0.35 },
      { x: 0.65, y: 0.35 },
    ],
  }
  s.proposal.candidates.push(lift)
  const dimensions = { width: 1000, height: 800 }
  expect(reconstructionPlacement(s.project, s.input, s.proposal, dimensions).note).toContain('aligned')
  lift.points = lift.points.map((point) => ({ ...point, x: point.x + 0.1 }))
  const conflict = reconstructionPlacement(s.project, s.input, s.proposal, dimensions)
  expect(conflict.note).toContain('withheld')
  expect(conflict.input.calibration.a).toEqual({ x: 0, z: 0 })
})
