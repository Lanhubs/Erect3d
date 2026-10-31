import { useEffect, useState } from 'react'
import { activeLevel } from '../domain/types'
import { useAnalysis } from '../features/import/useAnalysis'
import { usePlanSource } from '../features/import/usePlanSource'
import { useProject } from '../state/project'
import { CommandSearch } from './CommandSearch'
import { PanelDrawer, PanelRail, type PanelId } from './WorkspacePanels'
import { WorkspaceHeader, type WorkspaceMode } from './WorkspaceHeader'
import { WorkspacePanelSections } from './WorkspacePanelSections'
import { WorkspaceStageArea } from './WorkspaceStageArea'
import { buildWorkspaceCommands } from './workspaceCommands'
import { defaultReviewView, type WorkspaceProps } from './workspaceTypes'
import { sourceBounds } from './sourceBounds'
import { useCandidateAcceptance } from './useCandidateAcceptance'
import { usePlanAnalysis } from './usePlanAnalysis'
import { useProjectAutosave } from './useProjectAutosave'
import { useWorkspaceActions } from './useWorkspaceActions'
import { useWorkspaceShortcuts } from './useWorkspaceShortcuts'
import { useWorkspaceViews } from './useWorkspaceViews'
import { useWorkspaceZoom } from './useWorkspaceZoom'
import './compactWorkspace.css'
import './studioWorkspace.css'
export function Workspace({
  project,
  back,
  onBackendAnalysis,
  reconstructing = false,
  statusContent,
  collaborate,
  assistant,
  assistantOpen,
  previewing = false,
  previewControls,
  previewLevelId,
  wholeBuildingRequest,
}: WorkspaceProps) {
  const selection = useProject((s) => s.selection),
    tool = useProject((s) => s.tool),
    setTool = useProject((s) => s.setTool)
  const view = useProject((s) => s.view)
  const readOnly = useProject((s) => s.readOnly)
  const undo = useProject((s) => s.undo),
    redo = useProject((s) => s.redo)
  const dirty = useProject((s) => s.dirty),
    save = useProjectAutosave(project)
  const savedActiveLevelId = useProject((s) => s.activeLevelId),
    analysis = useAnalysis()
  const activeLevelId = previewLevelId || savedActiveLevelId
  const [localAnalysisMode, setLocalAnalysisMode] = useState(false),
    backend = Boolean(onBackendAnalysis) || !localAnalysisMode
  const planSource = usePlanSource(
    project,
    activeLevelId || project.buildings[0].levels[0].id,
    analysis.clear,
  )
  const { source, url, error } = planSource
  const clearAnalysis = analysis.clear
  const [page, setPage] = useState(source?.page || 1),
    [showImport, setShowImport] = useState(!project.sources.length)
  const [manualScale, setManualScale] = useState(false)
  const [roofShown, setRoofShown] = useState(true)
  const [isolateId, setIsolateId] = useState<string | null>(null),
    [underlayId, setUnderlayId] = useState<string | null>(null)
  const [walkRequest, setWalkRequest] = useState(0),
    [walking, setWalking] = useState(false)
  const [mode, setMode] = useState<WorkspaceMode>('edit'),
    [reviewView, setReviewView] = useState(defaultReviewView)
  useWorkspaceZoom(mode === 'present' ? 'model' : view)
  const [panel, setPanel] = useState<PanelId | null>(null),
    [pinned, setPinned] = useState(false),
    [searching, setSearching] = useState(false)
  const [selectedDetection, setSelectedDetection] = useState<string | null>(null)
  const level = activeLevel(project, activeLevelId)
  const calibration =
    level.calibration || (level === project.buildings[0].levels[0] ? project.calibration : undefined)
  const underlay = project.buildings[0].levels.find((item) => item.id === underlayId)
  const { exitPresentation, inspectorOpen, saveAutoScale, selectEntity, setInspectorOpen } =
    useWorkspaceActions({ levelId: level.id, panel, previewing, setMode, setPanel, sourceId: source?.id })
  const acceptCandidates = useCandidateAcceptance({
    analysis,
    levelId: level.id,
    levelLocked: level.locked,
    setRoofShown,
    setShowImport,
    sourceId: source?.id,
  })
  useEffect(() => {
    clearAnalysis()
  }, [source?.id, clearAnalysis])
  const sourceRect = sourceBounds(source, url, calibration, level.alignment)
  useWorkspaceShortcuts({ previewing, redo, setSearching, setTool, undo })
  const { analyzePlan, applyCalibration, applySpan, requestBuild, reuseGroundScale } = usePlanAnalysis({
    acceptCandidates,
    analysis,
    backend,
    calibration,
    level,
    onBackendAnalysis,
    project,
    saveAutoScale,
    setManualScale,
    setSelectedDetection,
    setMode,
    setShowImport,
    source,
    url,
  })
  const { chooseView, setOpeningChoice, walk } = useWorkspaceViews({
    acceptCandidates,
    analysis,
    analyzePlan,
    backend,
    level,
    onBackendAnalysis,
    readOnly,
    requestBuild,
    setMode,
    setShowImport,
    setWalkRequest,
    source,
  })
  const commands = buildWorkspaceCommands({
    assistant,
    chooseView,
    collaborate,
    readOnly,
    redo,
    save,
    setMode,
    setPanel,
    setTool,
    undo,
    walk,
  })
  return (
    <div className={`workspace compact-workspace studio-workspace ${mode}-mode`}>
      <WorkspaceHeader
        projectName={project.name}
        dirty={dirty}
        back={back}
        undo={undo}
        redo={redo}
        save={save}
        tool={tool}
        setTool={setTool}
        view={view}
        setView={chooseView}
        mode={mode}
        setMode={(next) => {
          setShowImport(false)
          setMode(next)
        }}
        walk={walk}
        walking={walking}
        selection={selection}
        inspectorOpen={inspectorOpen}
        toggleInspector={() => {
          setShowImport(false)
          setInspectorOpen((value) => !value)
        }}
        inspectorAvailable={mode === 'edit'}
        search={() => setSearching(true)}
        openPanel={setPanel}
        collaborate={collaborate}
        assistant={assistant}
        assistantOpen={assistantOpen}
        previewing={previewing}
      />
      <div className="workspace-body">
        <PanelRail
          active={panel}
          open={(id) => setPanel((before) => (before === id ? null : id))}
          levelName={level.name}
          warning={Boolean(error || analysis.error)}
        />
        <div className="work-main">
          <WorkspaceStageArea
            analysis={analysis}
            exitPresentation={exitPresentation}
            isolateId={isolateId}
            level={level}
            mode={mode}
            previewControls={previewControls}
            previewing={previewing}
            project={project}
            reviewView={reviewView}
            roofShown={roofShown}
            selectedDetection={selectedDetection}
            selectEntity={selectEntity}
            selection={selection}
            setPanel={setPanel}
            setRoofShown={setRoofShown}
            setSelectedDetection={setSelectedDetection}
            setWalking={setWalking}
            sourceRect={sourceRect}
            statusContent={statusContent}
            underlay={underlay}
            view={view}
            walkRequest={walkRequest}
            warning={Boolean(error || analysis.error)}
            wholeBuildingRequest={wholeBuildingRequest}
          />
        </div>
        <PanelDrawer
          active={panel}
          pinned={pinned}
          pin={() => setPinned((value) => !value)}
          close={() => setPanel(null)}
          open={setPanel}
        >
          <fieldset disabled={previewing} className="readonly-controls">
            <WorkspacePanelSections
              acceptCandidates={acceptCandidates}
              analysis={analysis}
              analyzePlan={analyzePlan}
              applyCalibration={applyCalibration}
              applySpan={applySpan}
              backend={backend}
              calibration={calibration}
              chooseView={chooseView}
              isolateId={isolateId}
              level={level}
              manualScale={manualScale}
              onBackendAnalysis={onBackendAnalysis}
              page={page}
              panel={panel}
              planSource={planSource}
              project={project}
              reconstructing={reconstructing}
              reviewView={reviewView}
              reuseGroundScale={reuseGroundScale}
              selectEntity={selectEntity}
              selectedDetection={selectedDetection}
              setLocalAnalysisMode={setLocalAnalysisMode}
              setManualScale={setManualScale}
              setMode={setMode}
              setOpeningChoice={setOpeningChoice}
              setPage={setPage}
              setPanel={setPanel}
              setReviewView={setReviewView}
              setSelectedDetection={setSelectedDetection}
              setIsolateId={setIsolateId}
              setShowImport={setShowImport}
              setUnderlayId={setUnderlayId}
              showImport={showImport}
              underlayId={underlayId}
            />
          </fieldset>
        </PanelDrawer>
      </div>
      {searching && <CommandSearch commands={commands} close={() => setSearching(false)} />}
    </div>
  )
}
