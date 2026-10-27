import { expect, test } from 'bun:test'
import { fixture } from './helpers'
import { duplicateLevel, newSlab } from '../../client/src/domain/levels'
import { reconstructionLevelContext, withLevelContext } from '../src/modules/ai/level-context'
import { planGeneration } from '../src/modules/ai/generation'
import { buildReconstruction } from '../src/modules/plan-analysis/reconstruction'
import { levelWithSystemVoids } from '../../client/src/geometry/systemVoidSlabs'
import { systemRoofVoids } from '../../client/src/geometry/systemRoofVoids'
import type { AnalysisInput, Candidate, Intelligence } from '../src/contracts/analysis'
import type { IntelligenceInput } from '../src/modules/ai/provider'

function paired() {
  const project = fixture(),
    building = project.buildings[0],
    lower = building.levels[0]
  lower.name = '1st Floor'
  lower.sourceId = 'lower_source'
  const upper = duplicateLevel(lower, '2nd Floor', 3.2)
  upper.sourceId = 'upper_source'
  upper.walls = []
  building.levels.push(upper)
  return { project, building, lower, upper }
}
test('paired sources supply explicit floor identity without copying a layout or confusing image and model coordinates', async () => {
  const { project, upper, lower } = paired(),
    before = structuredClone(project)
  const context = reconstructionLevelContext(project, upper.id)!
  expect(context.selected.name).toBe('2nd Floor')
  expect(context.selected.elevationMetres).toBe(3.2)
  expect(context.related[0]).toMatchObject({ id: lower.id, name: '1st Floor', hasSeparateSource: true })
  let seen: IntelligenceInput | undefined
  const provider = withLevelContext(
    {
      async interpret(input) {
        seen = input
        return {
          proposal: {
            coordinatesVersion: 1,
            coordinateSystem: 'normalized-image-top-left',
            candidates: [],
            warnings: [],
          },
        }
      },
    },
    project,
    upper.id,
  )
  const input: IntelligenceInput = {
    bytes: new Uint8Array([1, 2]),
    mime: 'image/jpeg',
    width: 1280,
    height: 736,
    candidates: [],
    pass: 'reconstruct-model',
    model: 'gemini-3.8-flash',
  }
  await provider.interpret(input, AbortSignal.timeout(1000))
  expect(seen?.levelContext).toEqual(context)
  expect(seen?.bytes).toBe(input.bytes)
  expect(input.levelContext).toBeUndefined()
  expect(project).toEqual(before)
  expect(reconstructionLevelContext(project, 'missing')).toBeUndefined()
})
test('Argon reconstruction uses supported settings; source repair gets enough bounded output for detailed rooms', () => {
  expect(planGeneration('gemini-4-argon', 'reconstruct-model')).toMatchObject({ maxOutputTokens: 32768 })
  expect(planGeneration('gemini-4-argon', 'validated-model-repair').temperature).toBeUndefined()
  expect(planGeneration('gemini-3.8-flash', 'validated-model-repair').maxOutputTokens).toBe(16000)
  expect(planGeneration('gemini-3.8-flash', 'reconstruct-model').temperature).toBe(0)
})
test('an upper open-to-below space cuts only its slab and preserves the lower floor, roof and floor-relative balcony', () => {
  const { project, building, upper, lower } = paired()
  delete lower.sourceId
  delete upper.sourceId
  const outline = [
    { x: 0.1, y: 0.1 },
    { x: 0.9, y: 0.1 },
    { x: 0.9, y: 0.9 },
    { x: 0.1, y: 0.9 },
  ]
  const base = { confidence: 0.95, evidence: 'Drawn feature', needsReview: true as const, uncertainties: [] }
  const candidates: Candidate[] = outline.map((point, i) => ({
    ...base,
    id: `wall_${i}`,
    kind: 'wall',
    points: [point, outline[(i + 1) % 4]],
  }))
  candidates.push(
    {
      ...base,
      id: 'void_boundary',
      kind: 'architectural-boundary',
      points: [
        { x: 0.4, y: 0.4 },
        { x: 0.6, y: 0.4 },
        { x: 0.6, y: 0.6 },
        { x: 0.4, y: 0.6 },
      ],
    },
    {
      ...base,
      id: 'balcony_boundary',
      kind: 'architectural-boundary',
      points: [
        { x: 0.1, y: 0.3 },
        { x: 0.1, y: 0.6 },
        { x: 0.02, y: 0.6 },
        { x: 0.02, y: 0.3 },
      ],
    },
  )
  const proposal: Intelligence = {
    coordinatesVersion: 1,
    coordinateSystem: 'normalized-image-top-left',
    candidates,
    warnings: [],
    understanding: {
      buildingType: 'villa',
      footprint: outline,
      circulation: [],
      conventions: [],
      uncertainties: [],
    },
    architecturalRequirements: {
      typology: 'villa',
      systems: [
        {
          id: 'upper_void',
          kind: 'void',
          name: 'Formal living room open to below',
          boundaryId: 'void_boundary',
          origin: 'detected',
          evidence: 'OPEN TO BELOW label',
          parameters: { elevation: 3.2, height: 6.4 },
        },
        {
          id: 'balcony',
          kind: 'articulation',
          profile: 'balcony',
          name: 'Open balcony',
          boundaryId: 'balcony_boundary',
          origin: 'detected',
          evidence: 'Guarded exterior balcony',
          assumptions: ['Guard height is an assumption'],
          parameters: { elevation: 0, height: 1.1, depth: 1.5, thickness: 0.18, spacing: 0.15 },
        },
      ],
    },
  }
  const input: AnalysisInput = {
    sourceAssetId: 'asset',
    sourceId: 'source',
    levelId: upper.id,
    calibration: {
      a: { x: 0, z: 0 },
      b: { x: 1000, z: 0 },
      knownMetres: 20,
      metresPerPixel: 0.02,
      method: 'manual',
    },
    deterministicCandidates: [],
    options: {
      mode: 'full',
      engine: 'backend',
      purpose: 'rebuild',
      designMode: 'faithful',
      complex: true,
      cloudConsent: true,
    },
  }
  lower.slabs = [
    newSlab(
      outline.map((point) => ({ x: point.x * 20, z: point.y * 20 })),
      0.2,
    ),
  ]
  const before = structuredClone(lower)
  const result = buildReconstruction(
    project,
    input,
    'paired_test',
    proposal,
    candidates,
    { width: 1000, height: 1000 },
    true,
  )
  const b = result.buildings[0],
    floor = b.levels[1]
  expect(b.levels[0]).toEqual(before)
  expect(levelWithSystemVoids(b.levels[0], b).slabs![0].openings).toHaveLength(0)
  expect(levelWithSystemVoids(floor, b).slabs![0].openings).toHaveLength(1)
  expect(systemRoofVoids(b, b.roofSections!)[0].voids).toHaveLength(0)
  expect(b.systems?.systems.find((system) => system.kind === 'articulation')?.elevation).toBe(0)
  expect(building.levels[1].walls).toHaveLength(0)
})
