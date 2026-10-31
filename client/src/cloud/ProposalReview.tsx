import { useRef, useState } from 'react'
import type { Candidate } from '../../../api/src/contracts/analysis'
import { api } from './api'
import { putTask } from './cache'
import { ProposalPreview } from './ProposalPreview'
import { ProposalModelPreview } from './ProposalModelPreview'
import { ProposalAnalysisReport } from './ProposalAnalysisReport'
import { ProposalCandidateReview } from './ProposalCandidateReview'
import { activeLevel, type SourceDocument } from '../domain/types'
import { useProject } from '../state/project'
import type { CloudSession } from './useCloudProject'
import { analysisStatus } from './analysisStatus'
import { reconstructionUpdate } from './reconstructionState'
import { useSourceScope } from './useSourceScope'
import { useProposalAnalysis } from './useProposalAnalysis'
import { useProposalAutoApply } from './useProposalAutoApply'
import { applyProposal } from './proposalAcceptance'
import {
  applyLabel,
  blocksAcceptance,
  reconstructionAdvice,
  rebuildSelection,
  wallChoices,
  type Acceptance,
  type Analysis,
} from './proposalReviewModel'
export function ProposalReview({
  analysisId,
  session,
  source,
  levelId,
  autoApply = false,
}: {
  analysisId: string
  session: CloudSession
  source: SourceDocument
  levelId: string
  autoApply?: boolean
}) {
  const [analysis, setAnalysis] = useState<Analysis>(),
    [candidates, setCandidates] = useState<Candidate[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set()),
    [acceptance, setAcceptance] = useState<Acceptance>()
  const [allowConfirmed, setAllowConfirmed] = useState<Set<string>>(new Set()),
    [selectedDesigns, setSelectedDesigns] = useState<Set<string>>(new Set())
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const [replaceLevel, setReplaceLevel] = useState(false)
  const [previewValid, setPreviewValid] = useState(false)
  const candidatesLoaded = useRef(false)
  const readOnly = useProject((state) => state.readOnly),
    record = session.record!,
    taskKey = `${record.key}/accept/${analysisId}`
  const context = { projectId: record.base.projectId, sourceId: source.id, levelId },
    scope = useSourceScope(context)
  const receive = (result: Analysis) => {
    if (!scope.current()) return
    setAnalysis(result)
    reconstructionUpdate(context, result, analysisId, reconstructionAdvice(result))
    const next = result.result?.proposal.candidates || []
    if (!candidatesLoaded.current && next.length) {
      candidatesLoaded.current = true
      setCandidates(next)
      if (
        result.options?.engine === 'backend' &&
        result.options.purpose === 'rebuild' &&
        result.status === 'ready'
      ) {
        setSelected(rebuildSelection(next))
        setReplaceLevel(true)
      }
    }
  }
  const refresh = async () => receive(await api.request<Analysis>(`/analysis/${analysisId}`))
  useProposalAnalysis({
    projectId: record.base.projectId,
    analysisId,
    taskKey,
    receive,
    restore: (task) => {
      setAcceptance(task)
      if (task) {
        setSelected(new Set(task.candidateIds))
        setSelectedDesigns(new Set(task.designIds))
        setAllowConfirmed(new Set(task.allowConfirmedIds))
      }
    },
    fail: setError,
  })
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true)
    setError('')
    try {
      scope.assertCurrent()
      await action()
      scope.assertCurrent()
      await refresh()
      return true
    } catch (error) {
      if (!scope.current()) return false
      const message = (error as Error).message
      setError(message)
      if (analysis?.status === 'ready')
        reconstructionUpdate(
          context,
          analysis,
          analysisId,
          `Could not apply the reconstruction: ${message}. Nothing from this result has been applied.`,
        )
      return false
    } finally {
      if (scope.current()) setBusy(false)
    }
  }
  const accept = () =>
    applyProposal({
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
    })
  const disabled = busy || readOnly || Boolean(acceptance)
  const backend = analysis?.options?.engine === 'backend',
    rebuilding = analysis?.options?.purpose === 'rebuild'
  const cannotApply = blocksAcceptance({
    busy,
    readOnly,
    analysis,
    acceptance,
    previewValid,
    selectedCount: selected.size,
    designCount: selectedDesigns.size,
    rebuilding,
    replaceLevel,
  })
  const project = useProject((state) => state.project)!,
    level = activeLevel(project, useProject.getState().activeLevelId)
  const walls = wallChoices(level.walls, candidates)
  useProposalAutoApply({
    autoApply,
    analysis,
    rebuilding,
    replaceLevel,
    selectedCount: selected.size,
    readOnly,
    apply: () => void run(accept),
  })
  return (
    <section aria-label="Cloud proposal review">
      <h3>Reconstruction result</h3>
      <p role="status">{analysisStatus(analysis)}</p>
      {analysis?.status === 'pending' && (
        <button
          disabled={busy || readOnly}
          onClick={() => void run(() => api.request(`/analysis/${analysisId}/cancel`, 'POST'))}
        >
          Cancel analysis
        </button>
      )}
      {(analysis?.status === 'ready' || (acceptance && analysis?.status === 'accepted')) && (
        <>
          <ProposalAnalysisReport
            analysis={analysis}
            source={source}
            backend={backend}
            rebuilding={rebuilding}
          />
          <ProposalPreview
            cacheKey={record.key}
            projectId={project.id}
            sourceId={source.id}
            width={source.width}
            height={source.height}
            candidates={candidates}
            selected={selected}
          />
          <ProposalModelPreview
            project={acceptance?.before || project}
            levelId={level.id}
            source={source}
            candidates={candidates.filter((candidate) => selected.has(candidate.id))}
            designs={(analysis.result?.proposal.designs || []).filter((design) =>
              selectedDesigns.has(design.id),
            )}
            apply={rebuilding && analysis?.status === 'ready' ? () => run(accept) : undefined}
            canApply={!cannotApply}
            applying={busy}
            applyError={error}
            onValidated={setPreviewValid}
            serverOnly={backend}
            autoOpen={!autoApply}
            acceptedModel={backend && analysis?.status === 'accepted' ? project : undefined}
            serverRequest={
              backend && analysis?.status === 'ready'
                ? {
                    analysisId,
                    baseRevision: record.base.revision,
                    candidateIds: [...selected],
                    edits: candidates.filter((item) => selected.has(item.id)),
                    allowConfirmedIds: [...allowConfirmed],
                    designIds: [...selectedDesigns],
                    replaceLevel,
                  }
                : undefined
            }
          />
          <ProposalCandidateReview
            candidates={candidates}
            selected={selected}
            select={setSelected}
            allowConfirmed={allowConfirmed}
            selectAllowConfirmed={setAllowConfirmed}
            designs={analysis.result?.proposal.designs || []}
            selectedDesigns={selectedDesigns}
            selectDesigns={setSelectedDesigns}
            walls={walls}
            update={(next) =>
              setCandidates((items) => items.map((item) => (item.id === next.id ? next : item)))
            }
            disabled={disabled}
            backend={backend}
          />
          <button className="primary" disabled={cannotApply} onClick={() => void run(accept)}>
            {applyLabel({
              busy,
              status: analysis.status,
              acceptance,
              rebuilding,
              selectedCount: selected.size,
              designCount: selectedDesigns.size,
            })}
          </button>
          {acceptance?.rejected && (
            <button
              disabled={busy || readOnly}
              onClick={() =>
                void run(async () => {
                  await session.engine?.refresh()
                  await putTask(taskKey, undefined)
                  setAcceptance(undefined)
                })
              }
            >
              Review again against current revision
            </button>
          )}
          <button
            disabled={busy || readOnly || Boolean(acceptance && !acceptance.rejected)}
            onClick={() => void run(() => api.request(`/analysis/${analysisId}/reject`, 'POST'))}
          >
            Reject proposal
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  )
}
