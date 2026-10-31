import type { Dispatch, SetStateAction } from 'react'
import type { Candidate } from '../../../api/src/contracts/analysis'
import { RemoteError } from '../../../api/client'
import { api } from './api'
import { putTask } from './cache'
import { useProject } from '../state/project'
import type { ReconstructionContext } from './reconstructionContext'
import { reconstructionUpdate } from './reconstructionState'
import type { CloudSession } from './useCloudProject'
import type { useSourceScope } from './useSourceScope'
import { acceptanceInput, type Acceptance, type Analysis } from './proposalReviewModel'
/**
 * Applies a reviewed proposal to the live model and records how far it got. The task is written before
 * the request and after each stage, so a reload or a rejected revision resumes instead of editing the
 * same floor twice.
 */
export async function applyProposal(input: {
  context: ReconstructionContext
  scope: ReturnType<typeof useSourceScope>
  session: CloudSession
  analysisId: string
  taskKey: string
  analysis?: Analysis
  acceptance?: Acceptance
  setAcceptance: Dispatch<SetStateAction<Acceptance | undefined>>
  candidates: Candidate[]
  selected: Set<string>
  allowConfirmed: Set<string>
  selectedDesigns: Set<string>
  replaceLevel: boolean
}) {
  const {
    context,
    scope,
    session,
    analysisId,
    taskKey,
    analysis,
    acceptance,
    setAcceptance,
    candidates,
    selected,
    allowConfirmed,
    selectedDesigns,
    replaceLevel,
  } = input
  scope.assertCurrent()
  reconstructionUpdate(
    context,
    { status: 'pending', job_status: 'running' },
    analysisId,
    'Erecting the editable 3D model…',
  )
  const engine = session.engine
  if (!engine) throw new Error('This tab is read only.')
  await engine.sync()
  scope.assertCurrent()
  if (engine.state !== 'saved') throw new Error('Resolve pending edits before accepting a proposal.')
  let pending = acceptance
  if (!pending) {
    pending = acceptanceInput({
      baseRevision: engine.record.base.revision,
      candidates,
      selected,
      allowConfirmed,
      selectedDesigns,
      replaceLevel,
      before: structuredClone(useProject.getState().project!),
    })
    await putTask(taskKey, pending)
    setAcceptance(pending)
  }
  scope.assertCurrent()
  try {
    await api.request(`/analysis/${analysisId}/accept`, 'POST', {
      operationId: pending.operationId,
      baseRevision: pending.baseRevision,
      candidateIds: pending.candidateIds,
      edits: pending.edits,
      allowConfirmedIds: pending.allowConfirmedIds || [],
      designIds: pending.designIds || [],
      replaceLevel: pending.replaceLevel || false,
    })
  } catch (error) {
    if (error instanceof RemoteError && error.status >= 400 && error.status < 500) {
      const rejected = { ...pending, rejected: true }
      await putTask(taskKey, rejected)
      setAcceptance(rejected)
    }
    throw error
  }
  scope.assertCurrent()
  await engine.refresh(() => scope.current() && !useProject.getState().previewBase)
  scope.assertCurrent()
  if (analysis?.options?.engine === 'backend' && engine.state === 'saved')
    useProject.getState().setView('model')
  if (engine.state === 'saved' && pending.before && !pending.historyRecorded) {
    useProject.getState().rememberAccepted(pending.before)
    const recorded = { ...pending, historyRecorded: true }
    await putTask(taskKey, recorded)
    setAcceptance(recorded)
  }
}
