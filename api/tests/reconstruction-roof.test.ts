import { expect, test } from 'bun:test'
import { buildReconstruction } from '../src/modules/plan-analysis/reconstruction'
import type { AnalysisInput, Candidate, Intelligence } from '../src/contracts/analysis'
import type { Project } from '../src/contracts/project'
import { defaultRoof } from '../../client/src/domain/types'
const ring = [
  { x: 0.1, y: 0.1 },
  { x: 0.9, y: 0.1 },
  { x: 0.9, y: 0.9 },
  { x: 0.1, y: 0.9 },
]
const base = {
  confidence: 0.95,
  evidence: 'Visible source wall band',
  uncertainties: [],
  needsReview: true as const,
}
const walls: Candidate[] = ring.map((point, i) => ({
  ...base,
  id: `w${i}`,
  kind: 'wall',
  points: [point, ring[(i + 1) % 4]],
}))
const rooms: Candidate[] = [
  {
    ...base,
    id: 'room-a',
    kind: 'room',
    points: [
      { x: 0.1, y: 0.1 },
      { x: 0.3, y: 0.1 },
      { x: 0.3, y: 0.3 },
      { x: 0.1, y: 0.3 },
    ],
  },
  {
    ...base,
    id: 'room-b',
    kind: 'room',
    points: [
      { x: 0.6, y: 0.6 },
      { x: 0.9, y: 0.6 },
      { x: 0.9, y: 0.9 },
      { x: 0.6, y: 0.9 },
    ],
  },
]
const input: AnalysisInput = {
  sourceAssetId: 'asset',
  sourceId: 'source',
  levelId: 'level',
  calibration: {
    a: { x: 0, z: 0 },
    b: { x: 1000, z: 0 },
    knownMetres: 10,
    metresPerPixel: 0.01,
    method: 'manual',
  },
  options: { mode: 'full', engine: 'backend', purpose: 'rebuild', complex: true, cloudConsent: true },
  deterministicCandidates: [],
}
const fixture = (): Project => ({
  id: 'project',
  name: 'Arena',
  modified: 1,
  units: 'm',
  sources: [],
  buildings: [
    {
      id: 'building',
      name: 'Arena',
      levels: [
        {
          id: 'level',
          name: 'Floor',
          elevation: 0,
          slabThickness: 0.2,
          walls: [],
          doors: [],
          windows: [],
          rooms: [],
        },
      ],
    },
  ],
})
const proposal: Intelligence = {
  coordinatesVersion: 1,
  coordinateSystem: 'normalized-image-top-left',
  candidates: [...walls, ...rooms],
  warnings: [],
  understanding: {
    buildingType: 'office',
    footprint: ring,
    conventions: [],
    circulation: [],
    uncertainties: [],
  },
}
test('disconnected detected rooms receive one envelope roof and retain the user roof choice', () => {
  const project = fixture()
  project.buildings[0].roof = { ...defaultRoof, shape: 'gable', material: 'corrugated' }
  const result = buildReconstruction(
    project,
    input,
    'analysis',
    proposal,
    proposal.candidates,
    { width: 1000, height: 1000 },
    true,
  )
  const sections = result.buildings[0].roofSections!
  expect(sections).toHaveLength(1)
  expect(sections[0].footprint).toHaveLength(4)
  expect(sections[0].roof.shape).toBe('gable')
  expect(sections[0].roof.material).toBe('corrugated')
  expect(project.buildings[0].roofSections).toBeUndefined()
  const level = result.buildings[0].levels[0]
  expect(level.slabs).toHaveLength(1)
  expect(level.slabs![0].polygon).toEqual(sections[0].footprint)
  expect(level.slabs![0].polygon.some((p) => p.x === 9 && p.z === 1)).toBe(true)
})
test('an office without a roof selection gets a coherent provisional hidden roof, and manual roof sections remain intact', () => {
  const result = buildReconstruction(
    fixture(),
    input,
    'analysis',
    proposal,
    proposal.candidates,
    { width: 1000, height: 1000 },
    true,
  )
  expect(result.buildings[0].roofSections).toHaveLength(1)
  expect(result.buildings[0].roofSections![0].roof.shape).toBe('hidden')
  const project = fixture(),
    manual = {
      id: 'manual',
      name: 'My roof',
      levelId: 'level',
      footprint: [
        { x: 1, z: 1 },
        { x: 9, z: 1 },
        { x: 9, z: 9 },
        { x: 1, z: 9 },
      ],
      roof: { ...defaultRoof, shape: 'shed' as const },
    }
  project.buildings[0].roofSections = [manual]
  expect(
    buildReconstruction(
      project,
      input,
      'analysis',
      proposal,
      proposal.candidates,
      { width: 1000, height: 1000 },
      true,
    ).buildings[0].roofSections,
  ).toEqual([manual])
})

test('office reconstruction uses a provisional flat roof while retaining an explicit roof selection', () => {
  const office = {
    ...proposal,
    understanding: { ...proposal.understanding!, buildingType: 'office' as const },
  }
  const result = buildReconstruction(
    fixture(),
    input,
    'analysis',
    office,
    office.candidates,
    { width: 1000, height: 1000 },
    true,
  )
  expect(result.buildings[0].roof!.shape).toBe('hidden')
  const project = fixture()
  project.buildings[0].roof = { ...defaultRoof, shape: 'shed' }
  expect(
    buildReconstruction(
      project,
      input,
      'analysis',
      office,
      office.candidates,
      { width: 1000, height: 1000 },
      true,
    ).buildings[0].roof!.shape,
  ).toBe('shed')
})
