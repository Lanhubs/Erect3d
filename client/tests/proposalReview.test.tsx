import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Candidate, Intelligence } from '../../api/src/contracts/analysis'
import {
  applyLabel,
  blocksAcceptance,
  chooseCandidate,
  reconstructionAdvice,
  rebuildSelection,
  wallChoices,
  type Analysis,
} from '../src/cloud/proposalReviewModel'
import { ProposalAnalysisReport } from '../src/cloud/ProposalAnalysisReport'
import { ProposalCandidateReview } from '../src/cloud/ProposalCandidateReview'
import type { SourceDocument } from '../src/domain/types'

const candidate = (over: Partial<Candidate> & { id: string }): Candidate =>
  ({
    kind: 'wall',
    points: [{ x: 0.1, y: 0.1 }],
    confidence: 0.8,
    evidence: 'Two parallel lines 0.12 m apart.',
    uncertainties: [],
    ...over,
  }) as Candidate

const ready = (issues: { code: string; severity: string; message: string }[] = []): Analysis =>
  ({
    status: 'ready',
    job_status: 'completed',
    result: {
      proposal: {
        coordinatesVersion: 1,
        coordinateSystem: 'normalized-image-top-left',
        candidates: [candidate({ id: 'wall_1' })],
        warnings: ['North arrow is inferred'],
      } as unknown as Intelligence,
      quality: { status: issues.length ? 'blocked' : 'ready', issues },
    },
  }) as Analysis

test('a blocked or detail-losing reconstruction explains what it withheld', () => {
  expect(reconstructionAdvice(ready())).toBeUndefined()
  expect(reconstructionAdvice({ status: 'pending', job_status: 'running' })).toBeUndefined()
  expect(
    reconstructionAdvice(
      ready([{ code: 'OPENING_UNHOSTED', severity: 'error', message: 'Door has no wall' }]),
    ),
  ).toBe('Needs correction: Door has no wall. Nothing from this result has been applied.')
  expect(
    reconstructionAdvice(
      ready([{ code: 'DETAIL_REGRESSION', severity: 'warning', message: 'Dropped detail' }]),
    ),
  ).toContain('omits detail from the current model')
})

test('a full rebuild preselects buildable elements and never a removal', () => {
  const found = [
    candidate({ id: 'wall_1' }),
    candidate({ id: 'unknown_1', kind: 'unknown' }),
    candidate({ id: 'stair_1', kind: 'stair', points: [{ x: 0, y: 0 }] }),
    candidate({ id: 'remove_1', action: 'remove' }),
  ]
  expect([...rebuildSelection(found)]).toEqual(['wall_1'])
})

test('choosing a correction drops the rival proposal for the same existing element', () => {
  const list = [
    candidate({ id: 'a', targetId: 'wall_9' }),
    candidate({ id: 'b', targetId: 'wall_9' }),
    candidate({ id: 'c' }),
  ]
  expect([...chooseCandidate(new Set(['b', 'c']), list[0], list)]).toEqual(['c', 'a'])
})

test('host choices keep existing walls and label the proposed ones', () => {
  const choices = wallChoices(
    [{ id: 'wall_9' }],
    [candidate({ id: 'wall_1', label: 'New partition' }), candidate({ id: 'door_1', kind: 'door' })],
  )
  expect(choices).toEqual([
    { id: 'wall_9', label: undefined },
    { id: 'wall_1', label: 'New partition' },
  ])
})

const base = {
  busy: false,
  readOnly: false,
  previewValid: false,
  selectedCount: 1,
  designCount: 0,
  rebuilding: false,
  replaceLevel: false,
}

test('the accept button refuses exactly the states an architect cannot apply', () => {
  expect(blocksAcceptance({ ...base, analysis: ready(), acceptance: undefined })).toBe(false)
  expect(blocksAcceptance({ ...base, analysis: ready(), acceptance: undefined, selectedCount: 0 })).toBe(true)
  expect(blocksAcceptance({ ...base, analysis: ready(), acceptance: undefined, busy: true })).toBe(true)
  expect(blocksAcceptance({ ...base, analysis: ready(), acceptance: undefined, rebuilding: true })).toBe(true)
  expect(
    blocksAcceptance({
      ...base,
      analysis: ready(),
      acceptance: undefined,
      rebuilding: true,
      replaceLevel: true,
    }),
  ).toBe(false)
  expect(
    blocksAcceptance({
      ...base,
      analysis: ready([{ code: 'X', severity: 'error', message: 'm' }]),
      acceptance: undefined,
    }),
  ).toBe(true)
  expect(
    blocksAcceptance({
      ...base,
      previewValid: true,
      analysis: ready([{ code: 'X', severity: 'error', message: 'm' }]),
      acceptance: undefined,
    }),
  ).toBe(false)
})

test('the button says what pressing it will do', () => {
  expect(
    applyLabel({
      busy: true,
      status: 'ready',
      acceptance: undefined,
      rebuilding: false,
      selectedCount: 2,
      designCount: 1,
    }),
  ).toBe('Applying reconstruction…')
  expect(
    applyLabel({ busy: false, status: 'accepted', rebuilding: false, selectedCount: 2, designCount: 1 }),
  ).toBe('Applied to your model')
  expect(
    applyLabel({
      busy: false,
      status: 'accepted',
      acceptance: { operationId: 'op_1', baseRevision: 3, candidateIds: [], edits: [], rejected: true },
      rebuilding: false,
      selectedCount: 2,
      designCount: 1,
    }),
  ).toBe('Applied to your model')
  expect(
    applyLabel({
      busy: false,
      status: 'ready',
      acceptance: undefined,
      rebuilding: true,
      selectedCount: 2,
      designCount: 1,
    }),
  ).toBe('Apply reconstruction to this floor')
  expect(
    applyLabel({
      busy: false,
      status: 'ready',
      acceptance: undefined,
      rebuilding: false,
      selectedCount: 2,
      designCount: 1,
    }),
  ).toBe('Accept 2 model changes / 1 designs')
})

const source = { id: 'source_1', width: 1000, height: 800 } as SourceDocument

test('the report renders the notes and the server checks without touching the model', () => {
  const markup = renderToStaticMarkup(
    <ProposalAnalysisReport
      analysis={ready([{ code: 'DETAIL_REGRESSION', severity: 'warning', message: 'Dropped stair detail' }])}
      source={source}
      backend
      rebuilding
    />,
  )
  expect(markup).toContain('Server model checks')
  expect(markup).toContain('North arrow is inferred')
  expect(markup).toContain('replaces this floor’s detected geometry')
  expect(markup).not.toContain('Building understanding')
})

test('an unhosted candidate still needs an interpretation before it can be chosen', () => {
  const list = [candidate({ id: 'door_1', kind: 'door', wallId: 'wall_9', label: 'Entry' })]
  const markup = renderToStaticMarkup(
    <ProposalCandidateReview
      candidates={list}
      selected={new Set(['door_1'])}
      select={() => {}}
      allowConfirmed={new Set()}
      selectAllowConfirmed={() => {}}
      designs={[]}
      selectedDesigns={new Set()}
      selectDesigns={() => {}}
      walls={[{ id: 'wall_9' }]}
      update={() => {}}
      disabled={false}
      backend={false}
    />,
  )
  expect(markup).toContain('Entry · 80% confidence')
  expect(markup).not.toContain('Select complete reconstruction')
})
