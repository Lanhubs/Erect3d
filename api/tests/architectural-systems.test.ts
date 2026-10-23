import { expect, test } from 'bun:test'
import type { AnalysisInput, Candidate, Intelligence } from '../src/contracts/analysis'
import { applyArchitecturalSystems } from '../src/modules/plan-analysis/architectural-systems'
import { regionalProposal } from '../src/workers/direct-regions'
import { reconcile } from '../src/modules/ai/reconcile'
import { fixture } from './helpers'
import { projectSchema } from '../src/contracts/project'
import { validateLockedLevels } from '../src/modules/projects/locked-levels'
const boundary: Candidate = {
  id: 'footprint',
  kind: 'room',
  points: [
    { x: 0.1, y: 0.1 },
    { x: 0.9, y: 0.1 },
    { x: 0.9, y: 0.9 },
    { x: 0.1, y: 0.9 },
  ],
  confidence: 0.9,
  evidence: 'Visible core enclosure',
  uncertainties: [],
  needsReview: true,
}
const proposal: Intelligence = {
  coordinatesVersion: 1,
  coordinateSystem: 'normalized-image-top-left',
  candidates: [boundary],
  warnings: [],
  architecturalRequirements: {
    typology: 'office-tower',
    systems: [
      {
        id: 'core',
        name: 'Lift core',
        kind: 'core',
        boundaryId: 'footprint',
        origin: 'detected',
        evidence: 'Lift core on source',
        parameters: { height: 12, thickness: 0.2 },
      },
      {
        id: 'repeat',
        name: 'Matching office floors',
        kind: 'typical-floors',
        origin: 'detected',
        evidence: 'Four levels in section',
        parameters: { count: 4, floorHeight: 3 },
      },
    ],
  },
}
const input: AnalysisInput = {
  sourceAssetId: 'asset',
  sourceId: 'source',
  levelId: 'floor',
  calibration: {
    a: { x: 0, z: 0 },
    b: { x: 1000, z: 0 },
    knownMetres: 10,
    metresPerPixel: 0.01,
    method: 'manual',
  },
  deterministicCandidates: [],
  options: { mode: 'full', complex: false, engine: 'backend', purpose: 'rebuild', cloudConsent: true },
}
test('architectural requirements persist in canonical metres with stable IDs and preserve manual systems', () => {
  const project = fixture(),
    level = project.buildings[0].levels[0],
    request = { ...input, levelId: level.id }
  applyArchitecturalSystems(project, request, 'analysis', proposal, proposal.candidates, {
    width: 1000,
    height: 800,
  })
  const core = project.buildings[0].systems!.systems[0]
  expect(core.kind === 'core' && core.polygon[0]).toEqual({ x: 1, z: 0.8 })
  expect(projectSchema.safeParse(project).success).toBe(true)
  const first = JSON.stringify(project.buildings[0].systems)
  applyArchitecturalSystems(project, request, 'analysis', proposal, proposal.candidates, {
    width: 1000,
    height: 800,
  })
  expect(JSON.stringify(project.buildings[0].systems)).toBe(first)
  const manual = project.buildings[0].systems!.systems[0]
  manual.origin = 'user-selected'
  manual.name = 'My confirmed core'
  applyArchitecturalSystems(project, request, 'analysis', proposal, proposal.candidates, {
    width: 1000,
    height: 800,
  })
  expect(project.buildings[0].systems!.systems).toHaveLength(2)
  expect(project.buildings[0].systems!.systems[0].name).toBe('My confirmed core')
  const next = structuredClone(project)
  next.buildings[0].levels[0].locked = true
  const changed = structuredClone(next)
  changed.buildings[0].systems!.systems[0].name = 'Changed core'
  expect(() => validateLockedLevels(next, changed)).toThrow('Unlock')
})
test('regional boundary references are renamed with their candidates and requirements from every region survive reconciliation', () => {
  const corner = { ...boundary, points: boundary.points.map((p) => ({ x: p.x * 0.4, y: p.y * 0.4 })) }
  const regional = regionalProposal({ ...proposal, candidates: [corner] }, 0, [])
  expect(regional.architecturalRequirements!.systems[0].boundaryId).toBe('region1_footprint')
  const merged = reconcile(
    [],
    [
      regional,
      {
        ...proposal,
        candidates: [],
        architecturalRequirements: {
          typology: 'office-tower',
          systems: [proposal.architecturalRequirements!.systems[1]],
        },
      },
    ],
    'full',
  )
  expect(merged.architecturalRequirements!.systems).toHaveLength(2)
  expect(merged.candidates[0].id).toBe('region1_footprint')
})
test('missing architectural boundaries fail explicitly instead of creating unrelated generic geometry', () => {
  const project = fixture(),
    request = { ...input, levelId: project.buildings[0].levels[0].id },
    before = JSON.stringify(project)
  expect(() =>
    applyArchitecturalSystems(project, request, 'analysis', proposal, [], { width: 1000, height: 800 }),
  ).toThrow('requires its source boundary')
  expect(JSON.stringify(project)).toBe(before)
})
test('a storey count does not automatically copy a unique ground floor without matching-layout evidence', () => {
  const project = fixture(),
    request = { ...input, levelId: project.buildings[0].levels[0].id }
  applyArchitecturalSystems(project, request, 'analysis', proposal, proposal.candidates, {
    width: 1000,
    height: 800,
  })
  expect(project.buildings[0].systems!.systems.find((s) => s.kind === 'typical-floors')).toMatchObject({
    origin: 'design-proposal',
    visible: false,
  })
  const matched = structuredClone(proposal),
    repeated = matched.architecturalRequirements!.systems.find((s) => s.kind === 'typical-floors')!
  repeated.layoutEvidence = {
    matchesTemplate: true,
    sourcePages: [2, 3],
    levelNames: ['Level 1', 'Level 2', 'Level 3', 'Level 4'],
    reason: 'Same partitions and opening schedule on the four explicitly labelled typical office floors',
  }
  applyArchitecturalSystems(project, request, 'analysis', matched, matched.candidates, {
    width: 1000,
    height: 800,
  })
  expect(project.buildings[0].systems!.systems.find((s) => s.kind === 'typical-floors')).toMatchObject({
    visible: true,
    layoutEvidence: repeated.layoutEvidence,
  })
})
