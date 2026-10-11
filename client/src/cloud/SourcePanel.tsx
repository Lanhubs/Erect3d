import { useEffect, useState } from 'react'
import { activeLevel } from '../domain/types'
import { useProject } from '../state/project'
import { sourceLinks, uploadPrivateSource } from './sources'
import { api } from './api'
import { getTask, putTask } from './cache'
import type { CloudSession } from './useCloudProject'
import { ProposalReview } from './ProposalReview'
export function SourcePanel({ session, available, aiAvailable }: { session: CloudSession; available: boolean; aiAvailable: boolean }) {
  const project = useProject(state => state.project)!, activeId = useProject(state => state.activeLevelId)
  const readOnly = useProject(state => state.readOnly), record = session.record!, level = activeLevel(project, activeId)
  const source = project.sources.find(source => source.id === level.sourceId)
  const [assetId, setAssetId] = useState(''), [analysisId, setAnalysisId] = useState(''), [busy, setBusy] = useState(false)
  const [error, setError] = useState(''), [consent, setConsent] = useState(false), [complex, setComplex] = useState(false)
  const [mode, setMode] = useState('structure')
  const taskKey = `${record.key}/analysis/${source?.id}`
  useEffect(() => {
    let alive = true; setAssetId(''); setAnalysisId(''); setError(''); setConsent(false)
    if (source) {
      sourceLinks(project.id).then(links => { if (alive) setAssetId(links.find(link => link.source_id === source.id)?.raster_asset_id || '') }).catch(error => { if (alive) setError(error.message) })
      getTask<{ analysisId?: string }>(taskKey).then(task => { if (alive) setAnalysisId(task?.analysisId || '') }).catch(error => { if (alive) setError(error.message) })
    }
    return () => { alive = false }
  }, [source?.id, project.id, taskKey])
  const ensureSynced = async () => {
    if (!session.engine) throw new Error('This tab is read only.')
    await session.engine.sync()
    if (session.engine.state !== 'saved') throw new Error('Sync pending edits or review their conflict first.')
  }
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError('')
    try { await ensureSynced(); await action() } catch (error) { setError((error as Error).message) } finally { setBusy(false) }
  }
  const analyze = async () => {
    if (!source || !level.calibration) throw new Error('Import a plan with automatic or manual scale first.')
    let task = await getTask<{ input: unknown; key: string; analysisId?: string }>(taskKey)
    if (task?.analysisId) {
      const result = await api.request<{ status: string }>(`/analysis/${task.analysisId}`)
      if (['pending', 'ready'].includes(result.status)) { setAnalysisId(task.analysisId); return }
      task = undefined
    }
    if (!task) {
      task = { input: { sourceAssetId: assetId, sourceId: source.id, levelId: level.id, page: source.page,
        calibration: level.calibration, alignment: level.alignment, options: { mode, complex, cloudConsent: true } }, key: crypto.randomUUID() }
      await putTask(taskKey, task)
    }
    const result = await api.request<{ analysisId: string }>(`/projects/${project.id}/analysis`, 'POST', task.input, task.key)
    await putTask(taskKey, { ...task, analysisId: result.analysisId }); setAnalysisId(result.analysisId)
  }
  return <section aria-label="Private source and cloud interpretation">
    <h3>Private floor plan</h3>{source ? <>
      <p>{source.name} · {source.width} × {source.height} · {assetId ? 'Linked to private storage' : 'Only cached on this device'}</p>
      {!available && <p>Private storage is not configured. Local imports and local interpretation remain available.</p>}
      <button disabled={busy || readOnly || !available} onClick={() => void run(async () => setAssetId(await uploadPrivateSource(record.key, project.id, source)))}>Upload plan privately</button>
      <h3>Optional cloud interpretation</h3>
      {!aiAvailable && <p>The cloud analysis provider is not configured.</p>}
      <div className="cloud-inline"><label>Detect<select value={mode} onChange={e => setMode(e.target.value)} disabled={busy}>
        <option value="structure">Structure and openings</option><option value="rooms">Rooms</option><option value="fixtures">Fixtures</option><option value="furniture">Furniture</option><option value="full">All details</option>
      </select></label><label><input type="checkbox" checked={complex} onChange={e => setComplex(e.target.checked)} disabled={busy} />Complex drawing</label></div>
      <label><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} disabled={busy} />Send this plan to the configured cloud analysis provider for a reviewable proposal.</label>
      <button className="primary" disabled={busy || readOnly || !aiAvailable || !assetId || !consent} onClick={() => void run(analyze)}>{busy ? 'Working…' : 'Request / resume cloud proposal'}</button>
      {analysisId && <ProposalReview key={analysisId} analysisId={analysisId} session={session} source={source} />}
    </> : <p>Import a plan on this level using the editor’s Import level plan control.</p>}
    {error && <p role="alert" className="error">{error}</p>}
  </section>
}
