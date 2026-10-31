import type { Dispatch, SetStateAction } from 'react'
import { ArchitecturalDetailsPanel } from '../features/structure/ArchitecturalDetailsPanel'
import { FurniturePanel } from '../furniture/FurniturePanel'
import { Inspector } from '../features/inspector/Inspector'
import { LevelManager } from '../features/levels/LevelManager'
import { StructurePanel } from '../features/structure/StructurePanel'
import { WorkspaceSourcePanels } from './WorkspaceSourcePanels'
import { useProject } from '../state/project'
import type { Calibration, Level, Project, Selection } from '../domain/types'
import type { OpeningChoice } from '../geometry/openingCandidates'
import type { ReviewView } from '../features/plan/ReviewLayer'
import type { useAnalysis } from '../features/import/useAnalysis'
import type { usePlanSource } from '../features/import/usePlanSource'
import type { PanelId } from './WorkspacePanels'
import type { View } from '../state/project'
import type { WorkspaceMode } from './WorkspaceHeader'

export function WorkspacePanelSections({
  acceptCandidates,
  analysis,
  analyzePlan,
  applyCalibration,
  applySpan,
  backend,
  calibration,
  chooseView,
  isolateId,
  level,
  manualScale,
  onBackendAnalysis,
  page,
  panel,
  planSource,
  project,
  reconstructing,
  reviewView,
  reuseGroundScale,
  selectEntity,
  selectedDetection,
  setLocalAnalysisMode,
  setManualScale,
  setMode,
  setOpeningChoice,
  setPage,
  setPanel,
  setReviewView,
  setSelectedDetection,
  setIsolateId,
  setShowImport,
  setUnderlayId,
  showImport,
  underlayId,
}: {
  acceptCandidates: (replace: boolean) => void
  analysis: ReturnType<typeof useAnalysis>
  analyzePlan: () => void
  applyCalibration: (a: { x: number; z: number }, b: { x: number; z: number }, known: number) => void
  applySpan: (metres: number) => void
  backend: boolean
  calibration?: Calibration
  chooseView: (view: View) => void
  isolateId: string | null
  level: Level
  manualScale: boolean
  onBackendAnalysis?: () => void
  page: number
  panel: PanelId | null
  planSource: ReturnType<typeof usePlanSource>
  project: Project
  reconstructing: boolean
  reviewView: ReviewView
  reuseGroundScale: () => void
  selectEntity: (next: Selection) => void
  selectedDetection: string | null
  setLocalAnalysisMode: Dispatch<SetStateAction<boolean>>
  setManualScale: Dispatch<SetStateAction<boolean>>
  setMode: Dispatch<SetStateAction<WorkspaceMode>>
  setOpeningChoice: (id: string, choice: OpeningChoice) => void
  setPage: Dispatch<SetStateAction<number>>
  setPanel: Dispatch<SetStateAction<PanelId | null>>
  setReviewView: Dispatch<SetStateAction<ReviewView>>
  setSelectedDetection: Dispatch<SetStateAction<string | null>>
  setIsolateId: Dispatch<SetStateAction<string | null>>
  setShowImport: Dispatch<SetStateAction<boolean>>
  setUnderlayId: Dispatch<SetStateAction<string | null>>
  showImport: boolean
  underlayId: string | null
}) {
  const readOnly = useProject((s) => s.readOnly),
    selection = useProject((s) => s.selection)
  return (
    <>
      <div hidden={panel !== 'levels'}>
        {' '}
        <LevelManager
          embedded
          project={project}
          activeId={level.id}
          isolateId={isolateId}
          setIsolateId={setIsolateId}
          underlayId={underlayId}
          setUnderlayId={setUnderlayId}
        />
      </div>
      <WorkspaceSourcePanels
        acceptCandidates={acceptCandidates}
        analysis={analysis}
        analyzePlan={analyzePlan}
        applyCalibration={applyCalibration}
        applySpan={applySpan}
        backend={backend}
        calibration={calibration}
        chooseView={chooseView}
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
        selectedDetection={selectedDetection}
        setLocalAnalysisMode={setLocalAnalysisMode}
        setManualScale={setManualScale}
        setMode={setMode}
        setOpeningChoice={setOpeningChoice}
        setPage={setPage}
        setReviewView={setReviewView}
        setSelectedDetection={setSelectedDetection}
        setShowImport={setShowImport}
        showImport={showImport}
      />
      <fieldset disabled={readOnly} className="readonly-controls">
        <div hidden={panel !== 'structure'}>
          <StructurePanel embedded project={project} level={level} select={selectEntity} />
        </div>
        <div hidden={panel !== 'details'}>
          <ArchitecturalDetailsPanel embedded level={level} select={selectEntity} />
        </div>
        <div hidden={panel !== 'furniture'}>
          {' '}
          <FurniturePanel
            embedded
            level={level}
            levels={project.buildings[0].levels}
            source={planSource.source}
            url={planSource.url}
            calibration={calibration}
            walls={analysis.candidates}
            rooms={analysis.rooms}
            completed={analysis.status === 'completed'}
            select={selectEntity}
          />
        </div>
        <div hidden={panel !== 'properties'}>
          <Inspector
            building={project.buildings[0]}
            level={level}
            selection={selection}
            unit={project.units}
            open={panel === 'properties'}
            onClose={() => setPanel(null)}
          />
        </div>
      </fieldset>
    </>
  )
}
