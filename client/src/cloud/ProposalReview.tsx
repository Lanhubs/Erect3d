import { useEffect, useState } from 'react'
import type { Candidate } from '../../../api/src/contracts/analysis'
import { RemoteError } from '../../../api/client'
import { api } from './api'
import { getTask, putTask } from './cache'
import { CandidateDetails } from './CandidateDetails'
import { ProposalPreview } from './ProposalPreview'
import { activeLevel, type SourceDocument } from '../domain/types'
import { useProject } from '../state/project'
import type { CloudSession } from './useCloudProject'
type Analysis = { status: string; job_status: string; failure_code?: string; result?: { proposal: { candidates: Candidate[]; warnings: string[] }; provenance?: unknown } }
type Acceptance = { operationId: string; baseRevision: number; candidateIds: string[]; edits: Candidate[]; rejected?: boolean }
export function ProposalReview({ analysisId, session, source }: { analysisId: string; session: CloudSession; source: SourceDocument }) {
  const [analysis, setAnalysis] = useState<Analysis>(), [candidates, setCandidates] = useState<Candidate[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set()), [acceptance, setAcceptance] = useState<Acceptance>()
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const readOnly = useProject(state => state.readOnly), record = session.record!, taskKey = `${record.key}/accept/${analysisId}`
  const refresh = async () => {
    const result = await api.request<Analysis>(`/analysis/${analysisId}`); setAnalysis(result)
    setCandidates(current => current.length ? current : result.result?.proposal.candidates || [])
  }
  useEffect(() => {
    let alive = true
    const load = async () => { try { if (alive) await refresh() } catch (error) { if (alive) setError((error as Error).message) } }
    void load(); getTask<Acceptance>(taskKey).then(task => { if (alive) { setAcceptance(task); if (task) setSelected(new Set(task.candidateIds)) } }).catch(error => { if (alive) setError(error.message) })
    const timer = setInterval(() => { if (alive) void load() }, 5000)
    return () => { alive = false; clearInterval(timer) }
  }, [analysisId, taskKey])
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true); setError('')
    try { await action(); await refresh() } catch (error) { setError((error as Error).message) } finally { setBusy(false) }
  }
  const accept = async () => {
    const engine = session.engine
    if (!engine) throw new Error('This tab is read only.')
    await engine.sync()
    if (engine.state !== 'saved') throw new Error('Resolve pending edits before accepting a proposal.')
    let input = acceptance
    if (!input) {
      input = { operationId: crypto.randomUUID(), baseRevision: engine.record.base.revision, candidateIds: [...selected], edits: candidates.filter(candidate => selected.has(candidate.id)) }
      await putTask(taskKey, input); setAcceptance(input)
    }
    try { await api.request(`/analysis/${analysisId}/accept`, 'POST', { operationId: input.operationId, baseRevision: input.baseRevision, candidateIds: input.candidateIds, edits: input.edits }) }
    catch (error) {
      if (error instanceof RemoteError && error.status >= 400 && error.status < 500) {
        const rejected = { ...input, rejected: true }; await putTask(taskKey, rejected); setAcceptance(rejected)
      }
      throw error
    }
    await engine.refresh()
  }
  const disabled = busy || readOnly || Boolean(acceptance)
  const project = useProject.getState().project!, level = activeLevel(project, useProject.getState().activeLevelId)
  const walls = [...candidates.filter(candidate => candidate.kind === 'wall').map(candidate => ({ id: candidate.id, label: candidate.label })), ...level.walls.map(wall => ({ id: wall.id }))]
  return <section aria-label="Cloud proposal review"><h3>Proposal review</h3><p>{analysis?.status || 'Loading…'} · {analysis?.job_status}{analysis?.failure_code ? ` · ${analysis.failure_code}` : ''}</p>
    <button disabled={busy} onClick={() => void run(refresh)}>Refresh proposal</button>
    {analysis?.status === 'pending' && <button disabled={busy || readOnly} onClick={() => void run(() => api.request(`/analysis/${analysisId}/cancel`, 'POST'))}>Cancel analysis</button>}
    {(analysis?.status === 'ready' || acceptance && analysis?.status === 'accepted') && <>
      <p>Nothing is added until you select and accept detections. Doors and windows need their host walls. Accepting completes this review; unselected detections are discarded.</p>
      {analysis.result?.proposal.warnings.map((warning, i) => <p key={i}>{warning}</p>)}
      <ProposalPreview cacheKey={record.key} projectId={project.id} sourceId={source.id} candidates={candidates} selected={selected} />
      <div className="cloud-candidates">{candidates.map(candidate => <article key={candidate.id}><label>
        <input type="checkbox" checked={selected.has(candidate.id)} disabled={disabled || ['unknown', 'void'].includes(candidate.kind)} onChange={e => setSelected(previous => {
          const next = new Set(previous); if (e.target.checked) next.add(candidate.id); else next.delete(candidate.id); return next
        })} />{candidate.label || candidate.kind} · {Math.round(candidate.confidence * 100)}% confidence
      </label>{['unknown', 'void'].includes(candidate.kind) && <p>Manual editing required.</p>}{candidate.kind === 'stair' && <p>Adds a stair guide; choose the target floor and opening in the editor.</p>}
        <CandidateDetails candidate={candidate} walls={walls} disabled={disabled} update={next => setCandidates(items => items.map(item => item.id === next.id ? next : item))} />
      </article>)}</div>
      <button className="primary" disabled={busy || readOnly || !selected.size || selected.size > 1000 || acceptance?.rejected} onClick={() => void run(accept)}>{acceptance ? 'Retry identical reviewed acceptance' : `Accept ${selected.size} reviewed detections`}</button>
      {acceptance?.rejected && <button disabled={busy || readOnly} onClick={() => void run(async () => { await session.engine?.refresh(); await putTask(taskKey, undefined); setAcceptance(undefined) })}>Review again against current revision</button>}
      <button disabled={busy || readOnly || Boolean(acceptance && !acceptance.rejected)} onClick={() => void run(() => api.request(`/analysis/${analysisId}/reject`, 'POST'))}>Reject proposal</button>
      <details><summary>Provider provenance</summary><pre>{JSON.stringify(analysis.result?.provenance || {}, null, 2)}</pre></details>
    </>}{error && <p role="alert" className="error">{error}</p>}
  </section>
}
