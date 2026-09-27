import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FiBox, FiDownload } from 'react-icons/fi'
import type { Calibration, Project, Selection } from '../domain/types'
import { levelOf } from '../domain/types'
import { calibrate } from '../geometry/math'
import { initialAutoScale, setEstimatedSpan } from '../geometry/autoScale'
import { assembleDraft } from '../geometry/reconstruct'
import type { OpeningChoice } from '../geometry/openingCandidates'
import { CalibrationPanel } from '../features/import/CalibrationPanel'
import { ScaleControls } from '../features/import/ScaleControls'
import { useAnalysis } from '../features/import/useAnalysis'
import { usePlanSource } from '../features/import/usePlanSource'
import { Inspector } from '../features/inspector/Inspector'
import { AnalysisPanel } from '../features/analysis/AnalysisPanel'
import { PlanEditor } from '../features/plan/PlanEditor'
import { ReconstructionFlow } from '../features/reconstruction/ReconstructionFlow'
import { ReviewPanel } from '../features/reconstruction/ReviewPanel'
import type { ReviewView } from '../features/plan/ReviewLayer'
import { saveProject } from '../state/database'
import { useProject } from '../state/project'
import { useWorkspaceZoom } from './useWorkspaceZoom'
import { WorkspaceHeader, type WorkspaceMode } from './WorkspaceHeader'
import { modelViewAction } from './modelViewAction'
const Viewer = lazy(() => import('../rendering/Viewer').then(module => ({ default: module.Viewer })))
export function Workspace({ project, back }: { project: Project; back: () => void }) {
  const selection = useProject(s => s.selection), select = useProject(s => s.setSelection)
  const tool = useProject(s => s.tool), setTool = useProject(s => s.setTool)
  const view = useProject(s => s.view), setView = useProject(s => s.setView)
  const setProject = useProject(s => s.setProject), edit = useProject(s => s.edit)
  const undo = useProject(s => s.undo), redo = useProject(s => s.redo)
  const dirty = useProject(s => s.dirty), markSaved = useProject(s => s.markSaved)
  const version = useProject(s => s.version)
  const analysis = useAnalysis()
  const { source, url, error, pages, busy, importFile, selectPage } = usePlanSource(project, analysis.clear)
  const clearAnalysis = analysis.clear
  const [page, setPage] = useState(source?.page || 1), [showImport, setShowImport] = useState(!project.sources.length)
  const [manualScale, setManualScale] = useState(false), autoStarted = useRef<string | null>(null), buildRequested = useRef(false)
  const [roofShown, setRoofShown] = useState(true)
  const [walkRequest, setWalkRequest] = useState(0)
  const [mode, setMode] = useState<WorkspaceMode>('edit'), [reviewView, setReviewView] = useState<ReviewView>({ source: true, walls: true, openings: true, opacity: .55 })
  const [selectedDetection, setSelectedDetection] = useState<string | null>(null)
  useWorkspaceZoom(mode === 'present' ? 'model' : view)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const selectEntity = (next: Selection) => { select(next); if (next) setInspectorOpen(true) }
  const level = levelOf(project)
  useEffect(() => { clearAnalysis() }, [source?.id, clearAnalysis])
  const sourceRect = useMemo(() => source && url && project.calibration ? {
    url, x: (0 - project.calibration.a.x) * project.calibration.metresPerPixel,
    z: (0 - project.calibration.a.z) * project.calibration.metresPerPixel,
    width: source.width * project.calibration.metresPerPixel, height: source.height * project.calibration.metresPerPixel,
  } : undefined, [source, url, project.calibration])
  useEffect(() => {
    if (!dirty) return
    const timer = setTimeout(() => saveProject(project).then(() => markSaved(version)).catch(console.error), 900)
    return () => clearTimeout(timer)
  }, [project, dirty, markSaved, version])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setTool('select')
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setTool, undo, redo])
  const applyCalibration = (a: { x: number; z: number }, b: { x: number; z: number }, known: number) => {
    const copy = structuredClone(project)
    copy.calibration = { ...calibrate(a, b, known), method: 'manual', basisPixels: Math.hypot(b.x - a.x, b.z - a.z) }; copy.modified = Date.now()
    setProject(copy); saveProject(copy)
    setShowImport(false); setManualScale(false); setMode('edit'); setView('plan')
    if (source && url) analysis.analyze(url, copy.calibration, source)
  }
  const save = async () => { await saveProject(project); markSaved(version) }
  const acceptCandidates = useCallback((replace: boolean) => {
    const safeOpenings = analysis.openings.map(item => item.choice === 'unknown' ? { ...item, choice: 'wall' as const } : item)
    const draft = assembleDraft(analysis.candidates, safeOpenings)
    edit(model => replace ? { ...draft, rooms: [], roof: model.roof }
      : { ...model, walls: [...model.walls, ...draft.walls], doors: [...model.doors, ...draft.doors],
        windows: [...model.windows, ...draft.windows], passages: [...model.passages, ...draft.passages] })
    analysis.clear()
    setShowImport(false); setView('model'); setTool('select')
  }, [analysis, edit, setView, setTool])
  const analyzePlan = () => {
    if (!source || !url) return
    setShowImport(false); setMode('edit'); setView('plan')
    analysis.analyze(url, project.calibration || initialAutoScale(source.width, source.height), source, saveAutoScale)
    setSelectedDetection(null)
  }
  const saveAutoScale = useCallback((estimate: Calibration) => {
    const current = useProject.getState().project
    if (!current || current.sources[0]?.id !== source?.id || current.calibration?.method === 'manual') return
    const copy = structuredClone(current); copy.calibration = estimate; copy.modified = Date.now()
    setProject(copy); void saveProject(copy)
  }, [source?.id, setProject])
  useEffect(() => {
    if (!source || !url || autoStarted.current === source.id) return
    if ((!project.calibration || project.calibration.method === 'auto') && !level.walls.length) {
      autoStarted.current = source.id
      void analysis.analyze(url, project.calibration || initialAutoScale(source.width, source.height), source, saveAutoScale)
    }
  }, [source, url, project.calibration, level.walls.length, analysis, saveAutoScale])
  useEffect(() => {
    if (!buildRequested.current || analysis.status !== 'completed') return
    const frame = requestAnimationFrame(() => { buildRequested.current = false
      if (analysis.candidates.length) acceptCandidates(level.walls.length > 0) })
    return () => cancelAnimationFrame(frame)
  }, [analysis.status, analysis.candidates.length, acceptCandidates, level.walls.length])
  const chooseView = (next: 'plan' | 'split' | 'model') => {
    setShowImport(false)
    const action = next === 'model' ? modelViewAction(analysis.status, analysis.candidates.length, level.walls.length, Boolean(source)) : 'show'
    if (action === 'build') { acceptCandidates(level.walls.length > 0); return }
    if (action === 'analyze' || action === 'wait') {
      buildRequested.current = true
      if (action === 'analyze') analyzePlan()
      return
    }
    setView(next)
  }
  const setOpeningChoice = (id: string, choice: OpeningChoice) => analysis.setOpeningChoices(current => ({ ...current, [id]: choice }))
  const applySpan = (metres: number) => {
    const copy = structuredClone(project)
    copy.calibration = setEstimatedSpan(copy.calibration!, metres); copy.modified = Date.now()
    setProject(copy); void saveProject(copy); setShowImport(false); setView('plan')
    if (source && url) analysis.analyze(url, copy.calibration, source)
  }
  return <div className={`workspace ${mode}-mode`}>
    <WorkspaceHeader projectName={project.name} dirty={dirty} back={back} undo={undo} redo={redo} save={save}
      tool={tool} setTool={setTool} view={view} setView={chooseView} mode={mode} setMode={next => { setShowImport(false); setMode(next) }}
      walk={() => { setMode('edit'); chooseView('model'); setWalkRequest(value => value + 1) }}
      selection={selection} inspectorOpen={inspectorOpen} toggleInspector={() => setInspectorOpen(value => !value)}
      inspectorAvailable={mode === 'edit' && !showImport} />
    <div className="workspace-body"><div className="work-main">
      <div className="source-strip">
        <span><FiDownload /> {source ? `${source.name}${source.page ? ` · page ${source.page}` : ''} · ${source.width.toLocaleString()} × ${source.height.toLocaleString()} px` : 'No source plan'}</span>
        <div>
          <label className="file-button">{source ? 'Replace plan' : 'Import plan'}
            <input type="file" accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
              onChange={async event => {
                const chosen = event.target.files?.[0]
                if (chosen && await importFile(chosen)) { setPage(1); setShowImport(false); setManualScale(false); setMode('edit'); setView('plan') }
                event.target.value = ''
              }} />
          </label>
          {source && <button onClick={() => setShowImport(value => !value)}>
            {showImport ? 'Close source' : 'Source & scale'}
          </button>}
        </div>
      </div>
      <ReconstructionFlow source={source} calibrated={Boolean(project.calibration)} calibrationOpen={showImport} ready={Boolean(url && !busy)}
        walls={level.walls.length} candidates={analysis.candidates.length} unresolved={analysis.openings.filter(item => item.choice === 'unknown').length} status={analysis.status}
        analyze={analyzePlan} generate={analyzePlan}
        manual={() => { setShowImport(false); setView('plan'); setTool('wall') }}
        build={acceptCandidates} discard={analysis.clear}
        view3D={() => chooseView('model')} />
      {analysis.status === 'completed' && analysis.candidates.length > 0 && <ReviewPanel openings={analysis.openings}
        view={reviewView} setView={change => setReviewView(current => ({ ...current, ...change }))}
        selected={selectedDetection} removeWall={() => { analysis.setCandidates(items => items.filter(item => item.id !== selectedDetection)); setSelectedDetection(null) }}
        setChoice={setOpeningChoice} resolveUnknown={() => analysis.setOpeningChoices(current => ({ ...current,
          ...Object.fromEntries(analysis.openings.filter(item => item.choice === 'unknown').map(item => [item.id, 'wall'])) }))} />}
      {error && <div className="inline-error">{error}</div>}
      {busy && <div className="inline-note">Preparing source document…</div>}
      {source && (source.width < 300 || source.height < 300) &&
        <div className="inline-note">Low-resolution plan: automatic analysis may miss fine details. You can edit the result in 2D.</div>}
      {pages > 1 && source?.mime === 'application/pdf' && <div className="page-choice">
        PDF page <input type="number" min="1" max={pages} value={page}
          onChange={event => setPage(Number(event.target.value))} />
        <span>of {pages}</span><button onClick={async () => { if (await selectPage(page)) { setShowImport(false); setManualScale(false); setMode('edit'); setView('plan') } }}>Load page</button>
      </div>}
      {analysis.error && <div className="inline-error">{analysis.error}</div>}
      {mode === 'analyze' ? <AnalysisPanel level={level} unit={project.units} /> :
        mode === 'present' ? <Suspense fallback={<div className="viewer-loading">Preparing presentation…</div>}>
          <Viewer key="present" level={level} selection={null} select={() => {}} roofShown={roofShown} setRoofShown={setRoofShown}
            presentation onExitPresentation={() => setMode('edit')} />
        </Suspense> : showImport && manualScale && source && url ? <CalibrationPanel
        key={source.id} url={url} width={source.width} height={source.height} unit={project.units}
        onSave={(a, b, metres) => { applyCalibration(a, b, metres); setShowImport(false) }} /> :
        showImport && source && url && project.calibration ? <div className="source-preview">
          <img src={url} alt="Imported floor plan" />
          <ScaleControls key={`${source.id}:${project.calibration.knownMetres}`} calibration={project.calibration} onApply={applySpan}
            onPoints={() => setManualScale(true)} onClose={() => setShowImport(false)} />
        </div> :
        <div className={`view-area ${view}`}>
          {view !== 'model' && <PlanEditor level={level} selection={selection} select={selectEntity}
            unit={project.units} source={sourceRect} review={analysis.status === 'completed' && analysis.candidates.length > 0
              ? { candidates: analysis.candidates, openings: analysis.openings, view: reviewView, selected: selectedDetection,
                setSelected: setSelectedDetection, setCandidates: analysis.setCandidates } : undefined} />}
          {view !== 'plan' && <Suspense fallback={<div className="viewer-loading">Preparing 3D model…</div>}>
            <Viewer key={view} level={level} selection={selection} select={selectEntity} roofShown={roofShown} setRoofShown={setRoofShown} walkRequest={walkRequest} />
          </Suspense>}
        </div>}
      <div className="statusbar">
        <span><FiBox /> {level.name}</span>
        <span>{level.walls.length} walls · {level.doors.length} doors · {level.windows.length} windows</span>
        <span>{project.units.toUpperCase()} · 1:1 MODEL</span>
      </div>
    </div>{mode === 'edit' && !showImport && <>
      {inspectorOpen && <button className="inspector-scrim" type="button" aria-label="Close properties" onClick={() => setInspectorOpen(false)} />}
      <Inspector level={level} selection={selection} unit={project.units} open={inspectorOpen} onClose={() => setInspectorOpen(false)} />
    </>}</div>
  </div>
}
