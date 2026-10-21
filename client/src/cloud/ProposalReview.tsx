import { useEffect, useRef, useState } from 'react'
import type { Candidate, Intelligence } from '../../../api/src/contracts/analysis'
import { RemoteError } from '../../../api/client'
import { api } from './api'
import { getTask, putTask } from './cache'
import { CandidateDetails } from './CandidateDetails'
import { ProposalPreview } from './ProposalPreview'
import { ProposalModelPreview } from './ProposalModelPreview'
import { DesignReview } from './DesignReview'
import { activeLevel, type Project, type SourceDocument } from '../domain/types'
import { useProject } from '../state/project'
import type { CloudSession } from './useCloudProject'
import { analysisStatus } from './analysisStatus'
import { buildableCandidates } from '../../../api/src/modules/plan-analysis/quality'
import {watchAnalysis} from './watchAnalysis'
import {reconstructionUpdate} from './reconstructionState'
import {useSourceScope} from './useSourceScope'
type Analysis = { status: string; job_status: string;created_at?:string; options?:{engine?:string;purpose?:string}; failure_code?: string; progress?: { completed: string[]; stages: string[]; current: string }; result?: { proposal: Intelligence; provenance?: unknown;quality?:{status:string;issues:{code:string;message:string;severity:string}[]} } }
type Acceptance = { operationId: string; baseRevision: number; candidateIds: string[]; edits: Candidate[]; allowConfirmedIds?: string[]; designIds?: string[]; replaceLevel?:boolean; rejected?: boolean; before?: Project; historyRecorded?: boolean }
export function ProposalReview({ analysisId, session, source,levelId,autoApply=false }: { analysisId: string; session: CloudSession; source: SourceDocument;levelId:string;autoApply?:boolean }) {
  const [analysis, setAnalysis] = useState<Analysis>(), [candidates, setCandidates] = useState<Candidate[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set()), [acceptance, setAcceptance] = useState<Acceptance>()
  const [allowConfirmed, setAllowConfirmed] = useState<Set<string>>(new Set()), [selectedDesigns, setSelectedDesigns] = useState<Set<string>>(new Set())
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [replaceLevel,setReplaceLevel]=useState(false)
  const [previewValid,setPreviewValid]=useState(false)
  const candidatesLoaded=useRef(false)
  const autoApplied=useRef(false)
  const readOnly = useProject(state => state.readOnly), record = session.record!, taskKey = `${record.key}/accept/${analysisId}`
  const context={projectId:record.base.projectId,sourceId:source.id,levelId},scope=useSourceScope(context)
  const receive = (result:Analysis) => {
    if(!scope.current())return
    const regression=result.result?.quality?.issues.find(issue=>['DETAIL_REGRESSION','SOURCE_DETAIL_INCOMPLETE'].includes(issue.code))
    const blocking=result.result?.quality?.issues.find(issue=>issue.severity==='error')
    setAnalysis(result);reconstructionUpdate(context,result,analysisId,result.status==='ready' && blocking?`Needs correction: ${blocking.message}. Nothing from this result has been applied.`:result.status==='ready' && regression?'Review needed: this reconstruction omits detail from the current model. Nothing from this result has been applied.':undefined)
    const next=result.result?.proposal.candidates || []
    if (!candidatesLoaded.current && next.length) {
      candidatesLoaded.current=true;setCandidates(next)
      if (result.options?.engine==='backend' && result.options.purpose==='rebuild' && result.status==='ready') {
        setSelected(new Set(buildableCandidates(next).filter(item=>item.action!=='remove').map(item=>item.id)))
        setReplaceLevel(true)
      }
    }
  }
  const refresh=async()=>receive(await api.request<Analysis>(`/analysis/${analysisId}`))
  useEffect(() => {
    let alive = true
    const stop=watchAnalysis(record.base.projectId,analysisId,()=>api.request<Analysis>(`/analysis/${analysisId}`),receive,error=>setError(error.message))
    getTask<Acceptance>(taskKey).then(task => { if (alive) { setAcceptance(task); if (task) { setSelected(new Set(task.candidateIds)); setSelectedDesigns(new Set(task.designIds)); setAllowConfirmed(new Set(task.allowConfirmedIds)) } } }).catch(error => { if (alive) setError(error.message) })
    return () => { alive = false;stop() }
  }, [analysisId, taskKey])
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true); setError('')
    try { scope.assertCurrent();await action();scope.assertCurrent();await refresh();return true } catch (error) {
      if(!scope.current())return false
      const message=(error as Error).message;setError(message)
      if(analysis?.status==='ready')reconstructionUpdate(context,analysis,analysisId,`Could not apply the reconstruction: ${message}. Nothing from this result has been applied.`)
      return false
    } finally { if(scope.current())setBusy(false) }
  }
  const accept = async () => {
    scope.assertCurrent();reconstructionUpdate(context,{status:'pending',job_status:'running'},analysisId,'Erecting the editable 3D model…')
    const engine = session.engine
    if (!engine) throw new Error('This tab is read only.')
    await engine.sync()
    scope.assertCurrent()
    if (engine.state !== 'saved') throw new Error('Resolve pending edits before accepting a proposal.')
    let input = acceptance
    if (!input) {
      input = { operationId: crypto.randomUUID(), baseRevision: engine.record.base.revision, candidateIds: [...selected],replaceLevel,
        edits: candidates.filter(candidate => selected.has(candidate.id)), allowConfirmedIds: [...allowConfirmed], designIds: [...selectedDesigns], before: structuredClone(useProject.getState().project!) }
      await putTask(taskKey, input); setAcceptance(input)
    }
    scope.assertCurrent()
    try { await api.request(`/analysis/${analysisId}/accept`, 'POST', { operationId: input.operationId, baseRevision: input.baseRevision, candidateIds: input.candidateIds, edits: input.edits, allowConfirmedIds: input.allowConfirmedIds || [], designIds: input.designIds || [],replaceLevel:input.replaceLevel || false }) }
    catch (error) {
      if (error instanceof RemoteError && error.status >= 400 && error.status < 500) {
        const rejected = { ...input, rejected: true }; await putTask(taskKey, rejected); setAcceptance(rejected)
      }
      throw error
    }
    scope.assertCurrent();await engine.refresh(() => scope.current() && !useProject.getState().previewBase)
    scope.assertCurrent()
    if (analysis?.options?.engine==='backend' && engine.state==='saved') useProject.getState().setView('model')
    if (engine.state === 'saved' && input.before && !input.historyRecorded) {
      useProject.getState().rememberAccepted(input.before)
      const recorded = { ...input, historyRecorded: true }; await putTask(taskKey, recorded); setAcceptance(recorded)
    }
  }
  const disabled = busy || readOnly || Boolean(acceptance)
  const backend=analysis?.options?.engine==='backend',rebuilding=analysis?.options?.purpose==='rebuild'
  const cannotApply=busy || readOnly || analysis?.status==='accepted' || analysis?.result?.quality?.status==='blocked' && !previewValid || (!selected.size && !selectedDesigns.size) || selected.size>1000 || Boolean(acceptance?.rejected) || rebuilding && !replaceLevel && !acceptance
  const project = useProject(state => state.project)!, level = activeLevel(project, useProject.getState().activeLevelId)
  const walls = [...new Map([...level.walls.map(wall => ({ id: wall.id, label: undefined as string | undefined })),
    ...candidates.filter(candidate => candidate.kind === 'wall').map(candidate => ({ id: candidate.id, label: candidate.label }))].map(wall => [wall.id, wall])).values()]
  useEffect(()=>{
    if(!autoApply || autoApplied.current || analysis?.status!=='ready' || analysis.result?.quality?.status==='blocked' || analysis.result?.quality?.issues.some(issue=>['DETAIL_REGRESSION','SOURCE_DETAIL_INCOMPLETE'].includes(issue.code)) || !rebuilding || !replaceLevel || !selected.size || readOnly)return
    autoApplied.current=true;void run(accept)
  },[autoApply,analysis?.status,replaceLevel,selected.size,readOnly])
  return <section aria-label="Cloud proposal review"><h3>Reconstruction result</h3><p role="status">{analysisStatus(analysis)}</p>
    {analysis?.status === 'pending' && <button disabled={busy || readOnly} onClick={() => void run(() => api.request(`/analysis/${analysisId}/cancel`, 'POST'))}>Cancel analysis</button>}
    {(analysis?.status === 'ready' || acceptance && analysis?.status === 'accepted') && <>
      <p>{analysis?.status === 'accepted' ? 'Accepted into the model. Use the editor’s Undo action to restore the previous model.' :
        backend?'Review the source overlay and proposed 3D model. Open detected details if you need to correct an element.':'Select and review each model change before accepting. Doors and windows need their host walls; unselected changes are discarded.'}</p>
      {!!analysis.result?.proposal.warnings.length && <details><summary>Interpretation notes · {analysis.result.proposal.warnings.length}</summary>{analysis.result.proposal.warnings.map((warning, i) => <p key={i}>{warning}</p>)}</details>}
      {backend && analysis.result?.quality && <details open={analysis.result.quality.status==='blocked'}><summary>Server model checks · {analysis.result.quality.status}</summary>
        {analysis.result.quality.issues.map((issue,i)=><p key={i}>{issue.severity==='error'?'Needs correction: ':''}{issue.message}</p>)}</details>}
      {rebuilding && <p>Applying replaces this floor’s detected geometry with the reviewed reconstruction. Other floors and your roof choices are preserved. Undo is available.</p>}
      {analysis.result?.proposal.understanding && <details><summary>Building understanding · {analysis.result.proposal.understanding.buildingType}</summary>
        <p>{analysis.result.proposal.understanding.circulation.join(' · ')}</p><p>{analysis.result.proposal.understanding.conventions.join(' · ')}</p>
        {analysis.result.proposal.understanding.uncertainties.map((text, i) => <p key={i}>{text}</p>)}</details>}
      <ProposalPreview cacheKey={record.key} projectId={project.id} sourceId={source.id} width={source.width} height={source.height} candidates={candidates} selected={selected} />
      <ProposalModelPreview project={acceptance?.before || project} levelId={level.id} source={source} candidates={candidates.filter(candidate => selected.has(candidate.id))} designs={(analysis.result?.proposal.designs || []).filter(design => selectedDesigns.has(design.id))}
        apply={rebuilding && analysis?.status==='ready'?()=>run(accept):undefined} canApply={!cannotApply} applying={busy} applyError={error}
        onValidated={setPreviewValid}
        serverOnly={backend} autoOpen={!autoApply} acceptedModel={backend && analysis?.status==='accepted'?project:undefined}
        serverRequest={backend && analysis?.status==='ready'?{analysisId,baseRevision:record.base.revision,candidateIds:[...selected],edits:candidates.filter(item=>selected.has(item.id)),allowConfirmedIds:[...allowConfirmed],designIds:[...selectedDesigns],replaceLevel}:undefined} />
      <details><summary>Edit detected details · {candidates.length} elements</summary>
      {backend && <button disabled={disabled} onClick={()=>setSelected(new Set(buildableCandidates(candidates).filter(item=>item.action!=='remove').map(item=>item.id)))}>Select complete reconstruction</button>}
      <div className="cloud-candidates">{candidates.map(candidate => <article key={candidate.id}><label>
        <input type="checkbox" checked={selected.has(candidate.id)} disabled={disabled || candidate.kind === 'unknown'} onChange={e => setSelected(previous => {
          const next = new Set(previous)
          if (e.target.checked) {
            if (candidate.targetId) candidates.filter(item=>item.targetId===candidate.targetId).forEach(item=>next.delete(item.id))
            next.add(candidate.id)
          } else next.delete(candidate.id)
          return next
        })} />{candidate.action==='remove'?`Remove existing ${candidate.kind}`:`${candidate.label || candidate.kind} · ${Math.round(candidate.confidence * 100)}% confidence`}
      </label>{candidate.targetId && <><p>{candidate.action==='remove'?'Removes':'Updates'} existing {candidate.kind} · {candidate.targetId}</p>
        {(candidate.confirmedFields?.length || 0) > 0 && <label><input type="checkbox" disabled={disabled} checked={allowConfirmed.has(candidate.id)} onChange={event => setAllowConfirmed(previous => {
          const next = new Set(previous); if (event.target.checked) next.add(candidate.id); else next.delete(candidate.id); return next
        })} />Approve this correction to my confirmed properties after review.</label>}</>}
        {candidate.kind === 'unknown' && <p>Choose an interpretation before acceptance.</p>}{candidate.kind === 'void' && <p>Cuts a reviewed opening in a containing slab. Review the boundary carefully.</p>}
        {candidate.kind === 'passage' && !candidate.wallId && <p>Open circulation guide. The route stays open without adding a wall; choose a real host only if this is a framed opening.</p>}
        {candidate.kind === 'stair' && <p>Keep as a footprint guide, or choose a destination floor. A complete connection must fit its rise, footprint and upper slab.</p>}
        <CandidateDetails candidate={candidate} walls={walls} disabled={disabled} update={next => setCandidates(items => items.map(item => item.id === next.id ? next : item))} />
      </article>)}</div>
      <DesignReview designs={analysis.result?.proposal.designs || []} selected={selectedDesigns} select={setSelectedDesigns} disabled={disabled} />
      </details><button className="primary" disabled={Boolean(cannotApply)} onClick={() => void run(accept)}>{busy?'Applying reconstruction…':analysis?.status==='accepted'?'Applied to your model':acceptance ? 'Retry applying reconstruction' : rebuilding?'Apply reconstruction to this floor':`Accept ${selected.size} model changes / ${selectedDesigns.size} designs`}</button>
      {acceptance?.rejected && <button disabled={busy || readOnly} onClick={() => void run(async () => { await session.engine?.refresh(); await putTask(taskKey, undefined); setAcceptance(undefined) })}>Review again against current revision</button>}
      <button disabled={busy || readOnly || Boolean(acceptance && !acceptance.rejected)} onClick={() => void run(() => api.request(`/analysis/${analysisId}/reject`, 'POST'))}>Reject proposal</button>
      {analysis.result?.provenance && <details><summary>Analysis diagnostics</summary><pre>{JSON.stringify(analysis.result.provenance, null, 2)}</pre></details>}
    </>}{error && <p role="alert" className="error">{error}</p>}
  </section>
}
