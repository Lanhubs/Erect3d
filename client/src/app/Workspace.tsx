import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { activeLevel, type Calibration, type Project, type Selection } from '../domain/types'
import { acceptInterpretation } from '../domain/acceptInterpretation'
import { reusedGroundCalibration, setLevelCalibration } from '../domain/levelCalibration'
import { calibrate } from '../geometry/math'
import { initialAutoScale, setEstimatedSpan } from '../geometry/autoScale'
import type { OpeningChoice } from '../geometry/openingCandidates'
import { CalibrationPanel } from '../features/import/CalibrationPanel'
import { useAnalysis } from '../features/import/useAnalysis'
import { usePlanSource } from '../features/import/usePlanSource'
import { Inspector } from '../features/inspector/Inspector'
import { BuildingAnalysis } from '../features/analysis/BuildingAnalysis'
import { PlanEditor } from '../features/plan/PlanEditor'
import { ReconstructionFlow } from '../features/reconstruction/ReconstructionFlow'
import { ReviewPanel } from '../features/reconstruction/ReviewPanel'
import type { ReviewView } from '../features/plan/ReviewLayer'
import { saveProject } from '../state/database'
import { useProject } from '../state/project'
import { useWorkspaceZoom } from './useWorkspaceZoom'
import { WorkspaceHeader, type WorkspaceMode } from './WorkspaceHeader'
import { modelViewAction } from './modelViewAction'
import { LevelManager } from '../features/levels/LevelManager'
import { StructurePanel } from '../features/structure/StructurePanel'
import { ArchitecturalDetailsPanel } from '../features/structure/ArchitecturalDetailsPanel'
import { SourceStrip } from './SourceStrip'
import { SourceNotice } from './SourceNotice'
import { WorkspaceStatus } from './WorkspaceStatus'
import { sourceBounds } from './sourceBounds'
import { SourceScalePreview } from './SourceScalePreview'
import { FurniturePanel } from '../furniture/FurniturePanel'
import { acceptFurniture } from '../furniture/acceptance'
import { useFurnitureReview } from '../furniture/reviewState'
import { useProjectAutosave } from './useProjectAutosave'
const Viewer = lazy(() => import('../rendering/Viewer').then(module => ({ default: module.Viewer })))
export function Workspace({ project, back }: { project: Project; back: () => void }) {
  const selection = useProject(s => s.selection), select = useProject(s => s.setSelection)
  const tool = useProject(s => s.tool), setTool = useProject(s => s.setTool)
  const view = useProject(s => s.view), setView = useProject(s => s.setView)
  const setProject = useProject(s => s.replaceDocument), editProject = useProject(s => s.editProject)
  const readOnly = useProject(s => s.readOnly)
  const undo = useProject(s => s.undo), redo = useProject(s => s.redo)
  const dirty = useProject(s => s.dirty), save = useProjectAutosave(project)
  const activeLevelId = useProject(s => s.activeLevelId), analysis = useAnalysis()
  const { source, url, error, pages, busy, importFile, selectPage } = usePlanSource(project, activeLevelId || project.buildings[0].levels[0].id, analysis.clear)
  const clearAnalysis = analysis.clear
  const [page, setPage] = useState(source?.page || 1), [showImport, setShowImport] = useState(!project.sources.length)
  const [manualScale, setManualScale] = useState(false), autoStarted = useRef<string | null>(null), buildRequested = useRef(false)
  const [roofShown, setRoofShown] = useState(true)
  const [isolateId, setIsolateId] = useState<string | null>(null), [underlayId, setUnderlayId] = useState<string | null>(null)
  const [walkRequest, setWalkRequest] = useState(0)
  const [mode, setMode] = useState<WorkspaceMode>('edit'), [reviewView, setReviewView] = useState<ReviewView>({ source: true, walls: true, openings: true, spaces: true, details: true, opacity: .55 })
  const [selectedDetection, setSelectedDetection] = useState<string | null>(null)
  useWorkspaceZoom(mode === 'present' ? 'model' : view)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const selectEntity = (next: Selection) => { const owner = next && project.buildings[0].levels.find(item => [item.walls, item.doors, item.windows, item.passages, item.rooms, item.slabs, item.columns, item.stairs, item.ramps, item.seatingSections, item.details, item.furniture].some(items => items?.some(element => element.id === next.id)))
    if (owner && owner.id !== activeLevelId) useProject.getState().setActiveLevel(owner.id); select(next); if (next) setInspectorOpen(true) }
  const level = activeLevel(project, activeLevelId)
  const calibration = level.calibration || (level === project.buildings[0].levels[0] ? project.calibration : undefined)
  const underlay = project.buildings[0].levels.find(item => item.id === underlayId)
  useEffect(() => { clearAnalysis() }, [source?.id, clearAnalysis])
  const sourceRect = sourceBounds(source, url, calibration, level.alignment)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setTool('select')
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setTool, undo, redo])
  const applyCalibration = (a: { x: number; z: number }, b: { x: number; z: number }, known: number) => {
    if (readOnly) return
    const next = { ...calibrate(a, b, known), method: 'manual' as const, basisPixels: Math.hypot(b.x - a.x, b.z - a.z) }
    const copy = setLevelCalibration(project, level.id, next)
    setProject(copy); saveProject(copy)
    setShowImport(false); setManualScale(false); setMode('edit'); setView('plan')
    if (source && url) analysis.analyze(url, next, source)
  }
  const acceptCandidates = useCallback((replace: boolean) => {
    if (useProject.getState().readOnly) return
    editProject(copy => { acceptInterpretation(copy, level.id, analysis.candidates, analysis.openings,
      analysis.details.filter(detail => analysis.detailChoices[detail.id]), replace, analysis.spaceChoices)
      const review = useFurnitureReview.getState(), building = copy.buildings[0]
      if (review.key === `${level.id}:${source?.id || ''}`) acceptFurniture(building.levels.find(item => item.id === level.id)!, review.candidates, building.levels)
      return copy })
    if (!level.locked && useFurnitureReview.getState().key === `${level.id}:${source?.id || ''}`) useFurnitureReview.getState().consumeAccepted(); analysis.clear()
    setShowImport(false); setRoofShown(false); setView('model'); setTool('select')
  }, [analysis, editProject, setView, setTool, level.id, level.locked, source?.id])
  const analyzePlan = () => {
    if (!source || !url) return
    setShowImport(false); setMode('edit'); setView('plan')
    analysis.analyze(url, calibration || initialAutoScale(source.width, source.height), source, saveAutoScale)
    setSelectedDetection(null)
  }
  const saveAutoScale = useCallback((estimate: Calibration) => {
    const current = useProject.getState().project
    if (!current || useProject.getState().readOnly || activeLevel(current, level.id).sourceId !== source?.id || activeLevel(current, level.id).calibration?.method === 'manual') return
    const copy = setLevelCalibration(current, level.id, estimate)
    setProject(copy); void saveProject(copy)
  }, [source?.id, setProject, level.id])
  useEffect(() => {
    if (readOnly || !source || !url || autoStarted.current === source.id) return
    if ((!calibration || calibration.method === 'auto') && !level.walls.length) {
      autoStarted.current = source.id
      void analysis.analyze(url, calibration || initialAutoScale(source.width, source.height), source, saveAutoScale)
    }
  }, [source, url, calibration, level.walls.length, analysis, saveAutoScale, readOnly])
  useEffect(() => {
    if (!buildRequested.current || analysis.status !== 'completed') return
    const frame = requestAnimationFrame(() => { buildRequested.current = false
      if (analysis.candidates.length) acceptCandidates(level.walls.length > 0) })
    return () => cancelAnimationFrame(frame)
  }, [analysis.status, analysis.candidates.length, acceptCandidates, level.walls.length])
  const chooseView = (next: 'plan' | 'split' | 'model') => {
    setShowImport(false)
    const action = next === 'model' && !readOnly ? modelViewAction(analysis.status, analysis.candidates.length, level.walls.length, Boolean(source)) : 'show'
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
    if (readOnly) return
    const next = setEstimatedSpan(calibration!, metres)
    const copy = setLevelCalibration(project, level.id, next)
    setProject(copy); void saveProject(copy); setShowImport(false); setView('plan')
    if (source && url) analysis.analyze(url, next, source)
  }
  const reuseGroundScale = () => {
    if (readOnly) return
    if (!source) return
    const next = reusedGroundCalibration(project, source)
    if (!next) return
    const copy = setLevelCalibration(project, level.id, next)
    setProject(copy); void saveProject(copy); setShowImport(false)
    if (url) analysis.analyze(url, next, source)
  }
  return <div className={`workspace ${mode}-mode`}>
    <WorkspaceHeader projectName={project.name} dirty={dirty} back={back} undo={undo} redo={redo} save={save}
      tool={tool} setTool={setTool} view={view} setView={chooseView} mode={mode} setMode={next => { setShowImport(false); setMode(next) }}
      walk={() => { setMode('edit'); chooseView('model'); setWalkRequest(value => value + 1) }}
      selection={selection} inspectorOpen={inspectorOpen} toggleInspector={() => { setShowImport(false); setInspectorOpen(value => !value) }}
      inspectorAvailable={mode === 'edit'} />
    <div className="workspace-body"><div className="work-main">
      <LevelManager project={project} activeId={level.id} isolateId={isolateId} setIsolateId={setIsolateId}
        underlayId={underlayId} setUnderlayId={setUnderlayId} />
      <fieldset disabled={readOnly} className="readonly-controls"><div className="workspace-overview">
        <StructurePanel project={project} level={level} select={selectEntity} />
        <ArchitecturalDetailsPanel level={level} select={selectEntity} />
      </div></fieldset>
      <fieldset disabled={readOnly} className="readonly-controls">
      <SourceStrip source={source} showImport={showImport} toggle={() => setShowImport(value => !value)}
        importFile={async chosen => { if (await importFile(chosen)) { setPage(1); setShowImport(false); setManualScale(false); setMode('edit'); setView('plan') } }} />
      <FurniturePanel level={level} levels={project.buildings[0].levels} source={source} url={url} calibration={calibration} walls={analysis.candidates} rooms={analysis.rooms} completed={analysis.status === 'completed'} select={selectEntity} />
      <ReconstructionFlow source={source} calibrated={Boolean(calibration)} calibrationOpen={showImport} ready={Boolean(url && !busy)}
        walls={level.walls.length} candidates={analysis.candidates.length} unresolved={analysis.openings.filter(item => item.choice === 'unknown').length} status={analysis.status}
        analyze={analyzePlan} generate={analyzePlan}
        manual={() => { setShowImport(false); setView('plan'); setTool('wall') }}
        build={acceptCandidates} discard={analysis.clear}
        view3D={() => chooseView('model')} />
      </fieldset>
      {analysis.status === 'completed' && analysis.candidates.length > 0 && <ReviewPanel openings={analysis.openings}
        rooms={analysis.rooms} spaceChoices={analysis.spaceChoices} selectedSpace={analysis.selectedSpace} selectSpace={analysis.setSelectedSpace}
        setSpaceChoice={(key, include) => analysis.setSpaceChoices(current => ({ ...current, [key]: include }))}
        details={analysis.details} detailChoices={analysis.detailChoices} report={analysis.report}
        setDetailChoice={(id, include) => analysis.setDetailChoices(current => ({ ...current, [id]: include }))}
        view={reviewView} setView={change => setReviewView(current => ({ ...current, ...change }))}
        selected={selectedDetection} removeWall={() => { analysis.setCandidates(items => items.filter(item => item.id !== selectedDetection)); setSelectedDetection(null) }}
        setChoice={setOpeningChoice} resolveUnknown={() => analysis.setOpeningChoices(current => ({ ...current,
          ...Object.fromEntries(analysis.openings.filter(item => item.choice === 'unknown').map(item => [item.id, 'wall'])) }))} />}
      <SourceNotice source={source} error={error} analysisError={analysis.error} busy={busy} pages={pages} page={page}
        setPage={setPage} selectPage={selectPage}
        onLoaded={() => { setShowImport(false); setManualScale(false); setMode('edit'); setView('plan') }} />
      {mode === 'analyze' ? <BuildingAnalysis building={project.buildings[0]} active={level} unit={project.units} /> :
        mode === 'present' ? <Suspense fallback={<div className="viewer-loading">Preparing presentation…</div>}>
          <Viewer key="present" building={project.buildings[0]} activeLevelId={level.id} isolateId={isolateId}
            selection={null} select={() => {}} roofShown={roofShown} setRoofShown={setRoofShown}
            presentation onExitPresentation={() => setMode('edit')} />
        </Suspense> : showImport && manualScale && source && url ? <CalibrationPanel
        key={source.id} url={url} width={source.width} height={source.height} unit={project.units}
        onSave={(a, b, metres) => { applyCalibration(a, b, metres); setShowImport(false) }} /> :
        showImport && source && url && calibration ? <SourceScalePreview source={source} url={url} calibration={calibration}
          groundScale={level.id === project.buildings[0].levels[0].id ? undefined : project.buildings[0].levels[0].calibration || project.calibration}
          onApply={applySpan} onPoints={() => setManualScale(true)} onClose={() => setShowImport(false)} onReuse={reuseGroundScale} /> :
        <div className={`view-area ${view}`}>
          {view !== 'model' && <PlanEditor level={level} selection={selection} select={selectEntity}
            unit={project.units} source={sourceRect} underlay={underlay} fence={level.id === project.buildings[0].levels[0].id ? project.buildings[0].siteFence : undefined} review={analysis.status === 'completed' && analysis.candidates.length > 0
              ? { candidates: analysis.candidates, openings: analysis.openings, view: reviewView, selected: selectedDetection,
                rooms: analysis.rooms, spaceChoices: analysis.spaceChoices, selectedSpace: analysis.selectedSpace, selectSpace: analysis.setSelectedSpace,
                details: analysis.details, detailChoices: analysis.detailChoices,
                setSelected: setSelectedDetection, setCandidates: analysis.setCandidates } : undefined} />}
          {view !== 'plan' && <Suspense fallback={<div className="viewer-loading">Preparing 3D model…</div>}>
            <Viewer key={view} building={project.buildings[0]} activeLevelId={level.id} isolateId={isolateId}
              selection={selection} select={selectEntity} roofShown={roofShown} setRoofShown={setRoofShown} walkRequest={walkRequest} />
          </Suspense>}
        </div>}
      <WorkspaceStatus level={level} units={project.units} />
    </div>{mode === 'edit' && <>
      {inspectorOpen && <button className="inspector-scrim" type="button" aria-label="Close properties" onClick={() => setInspectorOpen(false)} />}
      <fieldset disabled={readOnly} className="readonly-controls"><Inspector building={project.buildings[0]} level={level} selection={selection} unit={project.units} open={inspectorOpen} onClose={() => setInspectorOpen(false)} /></fieldset>
    </>}</div>
  </div>
}
