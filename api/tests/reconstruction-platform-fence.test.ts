import { expect, test } from 'bun:test'
import { fixture } from './helpers'
import { generateSiteFence } from '../../client/src/geometry/site'
import { buildReconstruction } from '../src/modules/plan-analysis/reconstruction'
import type { AnalysisInput, Intelligence } from '../src/contracts/analysis'

test('reconstruction refits automatic fences after source platforms exist and preserves manual boundaries', () => {
  const project = fixture(),
    building = project.buildings[0],
    level = building.levels[0]
  const boundary = [
    { x: 0.1, y: 0.1 },
    { x: 0.9, y: 0.1 },
    { x: 0.9, y: 0.9 },
    { x: 0.1, y: 0.9 },
  ]
  const base = { confidence: 0.9, evidence: 'Drawn source', uncertainties: [], needsReview: true as const }
  const proposal: Intelligence = {
    coordinatesVersion: 1,
    coordinateSystem: 'normalized-image-top-left',
    warnings: [],
    candidates: [
      ...boundary.map((point, index) => ({
        ...base,
        id: `wall_${index}`,
        kind: 'wall' as const,
        thickness: 0.02,
        points: [point, boundary[(index + 1) % 4]],
      })),
      {
        ...base,
        id: 'platform',
        kind: 'architectural-boundary',
        points: [
          { x: 0.1, y: 0.3 },
          { x: 0.1, y: 0.6 },
          { x: 0.02, y: 0.6 },
          { x: 0.02, y: 0.3 },
        ],
      },
    ],
    understanding: {
      buildingType: 'house',
      footprint: boundary,
      circulation: [],
      conventions: [],
      uncertainties: [],
    },
    architecturalRequirements: {
      typology: 'house',
      systems: [
        {
          id: 'porch',
          name: 'Covered porch',
          kind: 'articulation',
          profile: 'veranda',
          origin: 'detected',
          evidence: 'Source covered porch',
          boundaryId: 'platform',
          parameters: { elevation: 0, height: 3.2, depth: 0.8, thickness: 0.15, spacing: 1 },
        },
      ],
    },
  }
  const input: AnalysisInput = {
    sourceAssetId: 'asset',
    sourceId: 'source',
    levelId: level.id,
    calibration: {
      a: { x: 0, z: 0 },
      b: { x: 1000, z: 0 },
      knownMetres: 10,
      metresPerPixel: 0.01,
      method: 'manual',
    },
    deterministicCandidates: [],
    options: { mode: 'full', engine: 'backend', purpose: 'rebuild', cloudConsent: true, complex: false },
  }
  building.siteFence = generateSiteFence(building, { front: 0, rear: 0, left: 0, right: 0 })!
  building.siteFence.enabled = false
  const run = () =>
    buildReconstruction(
      project,
      input,
      'platform-fence',
      proposal,
      proposal.candidates,
      { width: 1000, height: 1000 },
      true,
    )
  const automatic = run().buildings[0].siteFence!
  expect(Math.min(...automatic.boundary!.map((point) => point.x))).toBeLessThan(0.2)
  expect(automatic.mode).toBe('automatic')
  expect(automatic.enabled).toBe(false)
  building.siteFence.mode = 'manual'
  expect(run().buildings[0].siteFence).toEqual(building.siteFence)
})
