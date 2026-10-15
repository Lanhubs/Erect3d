import { useEffect, useRef, useState } from 'react'
import { activeLevel } from '../domain/types'
import { useProject } from '../state/project'
import { sourceLinks, uploadPrivateSource } from './sources'
import type { StorageSavings } from './sources'
import { api } from './api'
import { getTask, putTask } from './cache'
import type { CloudSession } from './useCloudProject'
import { ProposalReview } from './ProposalReview'
import { sameEvidenceScale, useLocalEvidence } from './localEvidence'
import { EvidenceControls, type Region } from './EvidenceControls'
import { RemoteError } from '../../../api/client'
import {useReconstruction,reconstructionUpdate,reconstructionStarted} from './reconstructionState'
import {DesignReference} from './DesignReference'
export function SourcePanel({ session, available, aiAvailable, reconstructRequest=0 }: { session: CloudSession; available: boolean; aiAvailable: boolean; reconstructRequest?:number }) {
  const project = useProject(state => state.project)!, activeId = useProject(state => state.activeLevelId)
  const readOnly = useProject(state => state.readOnly), record = session.record!, level = activeLevel(project, activeId)
  const source = project.sources.find(source => source.id === level.sourceId)
  const building=project.buildings.find(item=>item.levels.some(floor=>floor.id===level.id))!
  const evidence = useLocalEvidence(state => state.evidence)
  const matchingEvidence = evidence?.sourceId === source?.id && sameEvidenceScale(evidence?.calibration, level.calibration) ? evidence : undefined
  const [assetId, setAssetId] = useState(''), [analysisId, setAnalysisId] = useState(''), [busy, setBusy] = useState(false)
  const [error, setError] = useState(''), [complex, setComplex] = useState(false)
  const [mode, setMode] = useState('full'),[engine,setEngine]=useState<'backend'|'hybrid'>('backend')
  const [purpose, setPurpose] = useState<'interpret' | 'enhance' | 'rebuild'>('rebuild'), [completion, setCompletion] = useState(false)
  const [designMode,setDesignMode]=useState<'creative'|'faithful'>('creative')
  const startedRequest=useRef(0)
  const operationRunning=useRef(false)
  const [region, setRegion] = useState<Region>()
  const [savings, setSavings] = useState<StorageSavings[]>([])
  const [autoApply,setAutoApply]=useState(false),[strategy,setStrategy]=useState<'direct'|'detailed'>('direct')
  const progress=useReconstruction(state=>state.current),pending=progress?.projectId===project.id && progress.status==='pending'
  const taskKey = `${record.key}/analysis/${source?.id}`
  useEffect(() => {
    let alive = true; setAssetId(''); setAnalysisId(''); setError(''); setRegion(undefined); setSavings([])
    setPurpose('rebuild')
    if (source) {
      sourceLinks(project.id).then(links => { if (alive) setAssetId(links.find(link => link.source_id === source.id)?.raster_asset_id || '') }).catch(error => { if (alive) setError(error.message) })
      getTask<{ analysisId?: string }>(taskKey).then(async task => {
        const recent=await api.request<{analysisId:string}|null>(`/projects/${project.id}/analysis?${new URLSearchParams({sourceId:source.id,levelId:level.id})}`).catch(()=>null) || task
        if(alive)setAnalysisId(recent?.analysisId || '')
        if(recent?.analysisId && recent.analysisId!==task?.analysisId)await putTask(taskKey,{analysisId:recent.analysisId})
      }).catch(error => { if (alive) setError(error.message) })
      getTask<{ savings?: StorageSavings[] }>(`${record.key}/upload/${source.id}`).then(task => { if (alive) setSavings(task?.savings || []) }).catch(error => { if (alive) setError(error.message) })
    }
    return () => { alive = false }
  }, [source?.id, project.id, taskKey])
  useEffect(()=>{
    if (!source || !session.reviewVersion || assetId) return
    let alive=true
    sourceLinks(project.id).then(links=>{if(alive)setAssetId(links.find(link=>link.source_id===source.id)?.raster_asset_id || '')}).catch(()=>{})
    getTask<{savings?:StorageSavings[]}>(`${record.key}/upload/${source.id}`).then(task=>{if(alive)setSavings(task?.savings || [])}).catch(()=>{})
    return()=>{alive=false}
  },[source?.id,project.id,record.key,session.reviewVersion])
  const ensureSynced = async () => {
    if (!session.engine) throw new Error('This tab is read only.')
    await session.engine.sync()
    if (session.engine.state !== 'saved') throw new Error('Sync pending edits or review their conflict first.')
  }
  const run = async (action: () => Promise<void>) => {
    if(operationRunning.current)return 'A source operation is already in progress.'
    operationRunning.current=true
    setBusy(true); setError('')
    try { await ensureSynced(); await action() } catch (error) {const message=(error as Error).message;setError(message);return message} finally {operationRunning.current=false; setBusy(false) }
  }
  const analyze = async (selectedAsset=assetId) => {
    if (!source || !level.calibration) throw new Error('Import a plan with automatic or manual scale first.')
    let task = await getTask<{ input: unknown; key: string; analysisId?: string }>(taskKey)
    if(!task?.analysisId) {
      const recent=await api.request<{analysisId:string}|null>(`/projects/${project.id}/analysis?${new URLSearchParams({sourceId:source.id,levelId:level.id})}`)
      if(recent?.analysisId)task={input:undefined,key:'',analysisId:recent.analysisId}
    }
    if (task?.analysisId) {
      const result = await api.request<{ status: string;prompt_version?:number;currentPromptVersion?:number;model_revision?:string;options?:{designMode?:string;styleReferenceAssetId?:string};result?:{quality?:{status:string}} }>(`/analysis/${task.analysisId}`)
      const current=(result.currentPromptVersion===undefined || result.prompt_version===result.currentPromptVersion) && (result.model_revision===undefined || Number(result.model_revision)===session.engine?.record.base.revision)
        && result.options?.styleReferenceAssetId===(designMode==='creative'?building.designReference?.assetId:undefined) && (!result.options?.designMode || result.options.designMode===designMode)
      if (current && ['pending', 'ready'].includes(result.status) && result.result?.quality?.status!=='blocked') {
        if (result.status==='pending') await api.request(`/analysis/${task.analysisId}/resume`,'POST')
        reconstructionStarted(project.id,task.analysisId,{status:result.status,job_status:result.status==='pending'?'running':'completed'});setAnalysisId(task.analysisId);return
      }
      task = undefined
    }
    if (!task) {
      const measured = useLocalEvidence.getState().evidence
      task = { input: { sourceAssetId: selectedAsset, sourceId: source.id, levelId: level.id, page: source.page,
        calibration: level.calibration, alignment: level.alignment, deterministicCandidates: engine==='hybrid' && matchingEvidence?measured?.candidates || []:[],
        options: { mode, complex, region:purpose==='rebuild'?undefined:region, purpose,engine,strategy,designMode,styleReferenceAssetId:designMode==='creative'?building.designReference?.assetId:undefined, architectureCompletion: completion, cloudConsent: true } }, key: crypto.randomUUID() }
      await putTask(taskKey, task)
    }
    let result:{ analysisId:string }
    try { result=await api.request(`/projects/${project.id}/analysis`,'POST',task.input,task.key) }
    catch (error) {
      // A definite validation rejection creates no job. Rebuild the request on retry.
      if (error instanceof RemoteError && error.status>=400 && error.status<500 && error.status!==429) await putTask(taskKey,undefined)
      throw error
    }
    await putTask(taskKey, { ...task, analysisId: result.analysisId });reconstructionStarted(project.id,result.analysisId,{status:'pending',job_status:'queued'}); setAnalysisId(result.analysisId)
  }
  const freshReview = async () => {
    const result = await api.request<{ status: string }>(`/analysis/${analysisId}`)
    if (result.status === 'pending') await api.request(`/analysis/${analysisId}/cancel`, 'POST')
    if (result.status === 'ready') await api.request(`/analysis/${analysisId}/reject`, 'POST')
    await putTask(taskKey, undefined); setAnalysisId('')
  }
  const reconstruct=(requested=false)=>{
    if(operationRunning.current || !requested && pending)return
    setAutoApply(true);useReconstruction.getState().update({projectId:project.id,status:'pending',job_status:'queued',startedAt:Date.now(),message:assetId?'Preparing the reconstruction…':'Uploading the original floor plan…'})
    return run(async()=>{
    if (!source) throw new Error('Import a floor plan first.')
    const uploaded=assetId || (await sourceLinks(project.id)).find(link=>link.source_id===source.id)?.raster_asset_id || await uploadPrivateSource(record.key,project.id,source,setSavings)
    setAssetId(uploaded);reconstructionUpdate(project.id,{status:'pending',job_status:'queued'},undefined,'Reading the original drawing…');await analyze(uploaded)
    }).then(message=>{if(message)reconstructionUpdate(project.id,{status:'failed',job_status:'failed'},undefined,message)})
  }
  useEffect(()=>{
    if (!reconstructRequest || startedRequest.current===reconstructRequest) return
    startedRequest.current=reconstructRequest
    if (!available || !aiAvailable) {const message='Reconstruction needs private storage and a configured Gemini provider.';setError(message);reconstructionUpdate(project.id,{status:'failed',job_status:'failed'},undefined,message);return}
    void reconstruct(true)
  },[reconstructRequest])
  return <section aria-label="Private source and cloud interpretation">
    <h3>Private floor plan</h3>{source ? <>
      <p>{source.name} · {source.width} × {source.height} · {assetId ? 'Linked to private storage' : 'Only cached on this device'}</p>
      {!available && <p>Private storage is not configured. Local imports and local interpretation remain available.</p>}
      <details><summary>Source storage</summary><button disabled={busy || readOnly || !available} onClick={() => void run(async () => setAssetId(await uploadPrivateSource(record.key, project.id, source, setSavings)))}>Store original privately</button>
      {savings.length > 0 && <p>{(savings.reduce((sum,item) => sum + item.inputBytes,0)/1024).toFixed(1)} KB original → {(savings.reduce((sum,item) => sum + item.storedBytes,0)/1024).toFixed(1)} KB stored. Lossless ZIP storage restores the exact original file.</p>}
      </details><h3>Reconstruct your floor plan</h3>
      <p>The original drawing is measured, interpreted in one coordinated request, and validated on the server. Reconstruct opens the editable model in 3D. Replacing this floor supports Undo; unclear geometry stays available for review.</p>
      {!aiAvailable && <p role="status">Gemini is not configured on this server.</p>}
      <button className="primary" disabled={busy || pending || readOnly || !available || !aiAvailable} onClick={()=>void reconstruct()}>{pending?'Reconstructing…':busy?'Starting reconstruction…':analysisId?'Resume / view reconstruction':'Reconstruct in 3D'}</button>
      <details><summary>Advanced interpretation options</summary>
      <label>Architecture<select value={designMode} onChange={event=>setDesignMode(event.target.value as typeof designMode)}><option value="creative">Creative architectural concept</option><option value="faithful">Measured plan only</option></select></label>
      {designMode==='creative' && <DesignReference projectId={project.id} building={building} disabled={busy || pending || readOnly || !available} ensureSynced={ensureSynced}/>}
      <label>Processing<select value={strategy} onChange={event=>setStrategy(event.target.value as 'direct'|'detailed')}><option value="direct">Direct reconstruction</option><option value="detailed">Extended detail review · slower</option></select></label>
      <label>Interpretation engine<select disabled={busy} value={engine} onChange={e=>setEngine(e.target.value as 'backend'|'hybrid')}>
        <option value="backend">Backend AI · source directly</option><option value="hybrid">AI with optional browser measurements</option></select></label>
      <label>Analysis goal<select disabled={busy} value={purpose} onChange={e => setPurpose(e.target.value as 'interpret' | 'enhance' | 'rebuild')}>
        <option value="rebuild">Reconstruct this floor from the source</option><option value="enhance">Enhance existing interpretation</option><option value="interpret">Add source geometry to this floor</option></select></label>
      <p>{purpose==='rebuild'?'The server studies the source, reads scale evidence, audits walls and openings, and builds a validated editable model. Replacement requires your approval and supports Undo.':'Enhancement preserves existing model IDs and design choices. Confirmed edits need separate approval.'}</p>
      <p>{engine==='backend'?`The server uses native-resolution OpenCV measurements and AI review. ${source.mime==='application/pdf'?'The original PDF and selected page are sent together.':'The original image and lossless detail crops are studied without resizing.'}`:matchingEvidence?`${matchingEvidence.candidates.length} optional browser measurements will accompany this plan.`:'Browser measurements are optional; use the control below to supply them.'}</p>
      {engine==='hybrid' && <EvidenceControls source={source} calibration={level.calibration} cacheKey={record.key} projectId={project.id} disabled={busy || readOnly} region={region} setRegion={setRegion} />}
      <div className="cloud-inline"><label>Detect<select value={mode} onChange={e => setMode(e.target.value)} disabled={busy}>
        <option value="structure">Structure and openings</option><option value="rooms">Rooms</option><option value="fixtures">Fixtures</option><option value="furniture">Furniture</option><option value="full">All details</option>
      </select></label><label><input type="checkbox" checked={complex} onChange={e => setComplex(e.target.checked)} disabled={busy} />Complex drawing</label></div>
      <label><input type="checkbox" checked={completion} onChange={e => setCompletion(e.target.checked)} disabled={busy} />Suggest roof alternatives, wall finishes and glazing for a separate design review.</label>
      </details><small>Reconstruction sends the plan and any chosen design reference to the configured Gemini provider.</small>
      {analysisId && <details><summary>Start another reconstruction</summary><p>Use changed settings or model edits in a new request.</p>
        <button disabled={busy || readOnly} onClick={() => void run(freshReview)}>Start a fresh review</button></details>}
      {analysisId && <ProposalReview key={analysisId} analysisId={analysisId} session={session} source={source} autoApply={autoApply} />}
    </> : <p>Import a plan on this level using the editor’s Import level plan control.</p>}
    {error && <p role="alert" className="error">{error}</p>}
  </section>
}
