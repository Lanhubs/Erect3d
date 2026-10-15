import { expect, test } from 'bun:test'
import type { Candidate, AnalysisInput } from '../src/contracts/analysis'
import { convertCandidates } from '../src/modules/plan-analysis/conversion'
import { validateGeometry } from '../src/modules/projects/geometry-validation'
import { fixture } from './helpers'
import { newSlab } from '../../client/src/domain/levels'
import { defaultRoof } from '../../client/src/domain/types'
const points = [{ x: .2, y: .2 }, { x: .4, y: .2 }, { x: .4, y: .4 }, { x: .2, y: .4 }]
const base = { confidence: .8, evidence: 'Reviewed drawing symbol', uncertainties: [], needsReview: true as const }
function setup() {
  const project = fixture(), level = project.buildings[0].levels[0]
  level.slabs = [newSlab([{ x: 0, z: 0 }, { x: 8, z: 0 }, { x: 8, z: 8 }, { x: 0, z: 8 }], .2)]
  level.roof = { ...defaultRoof, shape: 'gable' }; project.buildings[0].roof = level.roof
  const input: AnalysisInput = { sourceAssetId: 'asset_test', sourceId: 'source_test', levelId: level.id,
    calibration: { a: { x: 0, z: 0 }, b: { x: 100, z: 0 }, knownMetres: 1, metresPerPixel: .01 },
    options: { mode: 'full', complex: false, cloudConsent: true }, deterministicCandidates: [] }
  return { project, level, input }
}
test('reviewed passages, door semantics, circular columns and slab voids become normal entities without changing roofs', () => {
  const { project, level, input } = setup()
  const candidates: Candidate[] = [
    { ...base, id: 'passage', kind: 'passage', wallId: level.walls[0].id, points: [{ x: .1, y: 0 }, { x: .2, y: 0 }] },
    { ...base, id: 'door', kind: 'door', wallId: level.walls[0].id, doorStyle: 'double', hinge: 'right', swing: 'out', points: [{ x: .3, y: 0 }, { x: .5, y: 0 }] },
    { ...base, id: 'column', kind: 'column', columnShape: 'circular', points },
    { ...base, id: 'courtyard', kind: 'void', points },
  ]
  const result = convertCandidates(project, input, 'analysis_test', candidates, { width: 1000, height: 1000 })
  validateGeometry(result)
  const accepted = result.buildings[0].levels[0]
  expect(accepted.passages).toHaveLength(1)
  expect(accepted.doors[0].style).toBe('double'); expect(accepted.doors[0].hinge).toBe('right')
  expect(accepted.doors[0].swing).toBe('out'); expect(accepted.columns![0].shape).toBe('circular')
  expect(accepted.slabs![0].openings[0].kind).toBe('void')
  expect(result.buildings[0].roof).toEqual(project.buildings[0].roof)
  expect(project.buildings[0].levels[0].slabs![0].openings).toHaveLength(0)
})
test('voids outside slabs and stair connections without a valid destination are rejected before publication', () => {
  const { project, input } = setup()
  expect(() => convertCandidates(project, input, 'analysis_test', [{ ...base, id: 'void', kind: 'void',
    points: points.map(point => ({ x: point.x + .6, y: point.y + .6 })) }], { width: 1000, height: 1000 })).toThrow('must fit inside')
  expect(() => convertCandidates(project, input, 'analysis_test', [{ ...base, id: 'stairs', kind: 'stair',
    points, targetLevelId: 'missing_level' }], { width: 1000, height: 1000 })).toThrow('Choose an upper level')
})
test('a thin swung door leaf is not accepted as the wall opening geometry', () => {
  const { project, level, input } = setup()
  level.walls[0].start.z = 1; level.walls[0].end.z = 1
  expect(() => convertCandidates(project, input, 'analysis_test', [{ ...base, id: 'leaf', kind: 'door',
    wallId: level.walls[0].id, points: [{ x: .2, y: .05 }, { x: .3, y: .15 }] }],
    { width: 1000, height: 1000 })).toThrow('host wall gap')
})
