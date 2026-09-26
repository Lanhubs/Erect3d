import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { FiBox, FiDownload } from 'react-icons/fi'
import type { Project, Selection } from '../domain/types'
import { levelOf } from '../domain/types'
import { calibrate } from '../geometry/math'
import { assembleDraft } from '../geometry/reconstruct'
import type { OpeningChoice } from '../geometry/openingCandidates'
import { CalibrationPanel } from '../features/import/CalibrationPanel'
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
  const [page, setPage] = useState(source?.page || 1)
  const [showImport, setShowImport] = useState(!project.sources.length || !project.calibration)
  const [roofShown, setRoofShown] = useState(true)
  const [walkRequest, setWalkRequest] = useState(0)
  const [mode, setMode] = useState<WorkspaceMode>('edit')
  const [reviewView, setReviewView] = useState<ReviewView>({ source: true, walls: true, openings: true, opacity: .55 })
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
    copy.calibration = calibrate(a, b, known); copy.modified = Date.now()
    setProject(copy); saveProject(copy)
    setShowImport(false); setMode('edit'); setView('plan')
  }
  const save = async () => { await saveProject(project); markSaved(version) }
  const acceptCandidates = (replace: boolean) => {
    if (analysis.openings.some(item => item.choice === 'unknown')) return
    const draft = assembleDraft(analysis.candidates, analysis.openings)
    edit(model => replace ? { ...draft, rooms: [], roof: model.roof }
      : { ...model, walls: [...model.walls, ...draft.walls], doors: [...model.doors, ...draft.doors],
        windows: [...model.windows, ...draft.windows], passages: [...model.passages, ...draft.passages] })
    analysis.clear()
    setShowImport(false); setView('model'); setTool('select')
  }
  const analyzePlan = () => {
    if (!source || !url || !project.calibration) return
    setShowImport(false); setMode('edit'); setView('plan')
    analysis.analyze(url, project.calibration, source)
    setSelectedDetection(null)
  }
  const setOpeningChoice = (id: string, choice: OpeningChoice) => analysis.setOpeningChoices(current => ({ ...current, [id]: choice }))
  const recalibrate = () => {
    const copy = structuredClone(project)
    copy.calibration = undefined
    copy.modified = Date.now()
    setProject(copy); saveProject(copy)
  }
  return <div className={`workspace ${mode}-mode`}>
    <WorkspaceHeader projectName={project.name} dirty={dirty} back={back} undo={undo} redo={redo} save={save}
      tool={tool} setTool={setTool} view={view} setView={next => { setShowImport(false); setView(next) }} mode={mode} setMode={next => { setShowImport(false); setMode(next) }}
      walk={() => { setMode('edit'); setShowImport(false); setView('model'); setWalkRequest(value => value + 1) }}
      selection={selection} inspectorOpen={inspectorOpen} toggleInspector={() => setInspectorOpen(value => !value)}
      inspectorAvailable={mode === 'edit' && !(showImport && source && !project.calibration)} />
    <div className="workspace-body"><div className="work-main">
      <div className="source-strip">
        <span><FiDownload /> {source ? `${source.name}${source.page ? ` · page ${source.page}` : ''} · ${source.width.toLocaleString()} × ${source.height.toLocaleString()} px` : 'No source plan'}</span>
        <div>
          <label className="file-button">{source ? 'Replace plan' : 'Import plan'}
            <input type="file" accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
              onChange={async event => {
                const chosen = event.target.files?.[0]
                if (chosen && await importFile(chosen)) { setPage(1); setShowImport(true); setMode('edit'); setView('plan') }
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
        calibrate={() => setShowImport(true)} analyze={analyzePlan} generate={analyzePlan}
        manual={() => { setShowImport(false); setView('plan'); setTool('wall') }}
        build={acceptCandidates} discard={analysis.clear}
        view3D={() => { setShowImport(false); setView('model') }} />
      {analysis.status === 'completed' && analysis.candidates.length > 0 && <ReviewPanel openings={analysis.openings}
        view={reviewView} setView={change => setReviewView(current => ({ ...current, ...change }))}
        selected={selectedDetection} removeWall={() => { analysis.setCandidates(items => items.filter(item => item.id !== selectedDetection)); setSelectedDetection(null) }}
        setChoice={setOpeningChoice} resolveUnknown={() => analysis.setOpeningChoices(current => ({ ...current,
          ...Object.fromEntries(analysis.openings.filter(item => item.choice === 'unknown').map(item => [item.id, 'wall'])) }))} />}
      {error && <div className="inline-error">{error}</div>}
      {busy && <div className="inline-note">Preparing source document…</div>}
      {source && (source.width < 300 || source.height < 300) &&
        <div className="inline-note">Low-resolution plan: calibration and tracing are available, but automatic analysis may miss fine details.</div>}
      {pages > 1 && source?.mime === 'application/pdf' && <div className="page-choice">
        PDF page <input type="number" min="1" max={pages} value={page}
          onChange={event => setPage(Number(event.target.value))} />
        <span>of {pages}</span><button onClick={() => selectPage(page)}>Load page</button>
      </div>}
      {analysis.error && <div className="inline-error">{analysis.error}</div>}
      {mode === 'analyze' ? <AnalysisPanel level={level} unit={project.units} /> :
        mode === 'present' ? <Suspense fallback={<div className="viewer-loading">Preparing presentation…</div>}>
          <Viewer key="present" level={level} selection={null} select={() => {}} roofShown={roofShown} setRoofShown={setRoofShown}
            presentation onExitPresentation={() => setMode('edit')} />
        </Suspense> : showImport && source && url && !project.calibration ? <CalibrationPanel
        key={source.id} url={url} width={source.width} height={source.height} unit={project.units}
        onSave={(a, b, metres) => { applyCalibration(a, b, metres); setShowImport(false) }} /> :
        showImport && source && url ? <div className="source-preview">
          <img src={url} alt="Imported floor plan" />
          <div><strong>Scale calibrated</strong>
            <span>{project.calibration?.metresPerPixel.toFixed(5)} metres per pixel</span>
            <button onClick={recalibrate}>Recalibrate</button>
            <button onClick={() => setShowImport(false)}>Return to model</button>
          </div>
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
    </div>{mode === 'edit' && !(showImport && source && !project.calibration) && <>
      {inspectorOpen && <button className="inspector-scrim" type="button" aria-label="Close properties" onClick={() => setInspectorOpen(false)} />}
      <Inspector level={level} selection={selection} unit={project.units} open={inspectorOpen} onClose={() => setInspectorOpen(false)} />
    </>}</div>
  </div>
}
