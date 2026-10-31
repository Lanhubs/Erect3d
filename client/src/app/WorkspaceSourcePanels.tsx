import { SourceReviewSection } from './SourceReviewSection'
import { SourceScaleSection } from './SourceScaleSection'
import { SourceWorkflowSection } from './SourceWorkflowSection'
import type { Calibration, Level, Project } from '../domain/types'
import type { OpeningChoice } from '../geometry/openingCandidates'
import type { ReviewView } from '../features/plan/ReviewLayer'
import type { useAnalysis } from '../features/import/useAnalysis'
import type { usePlanSource } from '../features/import/usePlanSource'
import type { PanelId } from './WorkspacePanels'
import type { View } from '../state/project'
import type { WorkspaceMode } from './WorkspaceHeader'
import type { Dispatch, SetStateAction } from 'react'

export function WorkspaceSourcePanels({
  acceptCandidates,
  analysis,
  analyzePlan,
  applyCalibration,
  applySpan,
  backend,
  calibration,
  chooseView,
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
  selectedDetection,
  setLocalAnalysisMode,
  setManualScale,
  setMode,
  setOpeningChoice,
  setPage,
  setReviewView,
  setSelectedDetection,
  setShowImport,
  showImport,
}: {
  acceptCandidates: (replace: boolean) => void
  analysis: ReturnType<typeof useAnalysis>
  analyzePlan: () => void
  applyCalibration: (a: { x: number; z: number }, b: { x: number; z: number }, known: number) => void
  applySpan: (metres: number) => void
  backend: boolean
  calibration?: Calibration
  chooseView: (view: View) => void
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
  selectedDetection: string | null
  setLocalAnalysisMode: Dispatch<SetStateAction<boolean>>
  setManualScale: Dispatch<SetStateAction<boolean>>
  setMode: Dispatch<SetStateAction<WorkspaceMode>>
  setOpeningChoice: (id: string, choice: OpeningChoice) => void
  setPage: Dispatch<SetStateAction<number>>
  setReviewView: Dispatch<SetStateAction<ReviewView>>
  setSelectedDetection: Dispatch<SetStateAction<string | null>>
  setShowImport: Dispatch<SetStateAction<boolean>>
  showImport: boolean
}) {
  return (
    <div hidden={panel !== 'source'}>
      <SourceWorkflowSection
        acceptCandidates={acceptCandidates}
        analysis={analysis}
        analyzePlan={analyzePlan}
        backend={backend}
        calibration={calibration}
        chooseView={chooseView}
        level={level}
        onBackendAnalysis={onBackendAnalysis}
        planSource={planSource}
        project={project}
        reconstructing={reconstructing}
        setLocalAnalysisMode={setLocalAnalysisMode}
        setManualScale={setManualScale}
        setMode={setMode}
        setPage={setPage}
        setShowImport={setShowImport}
        showImport={showImport}
      />
      <SourceReviewSection
        analysis={analysis}
        reviewView={reviewView}
        selectedDetection={selectedDetection}
        setOpeningChoice={setOpeningChoice}
        setReviewView={setReviewView}
        setSelectedDetection={setSelectedDetection}
      />
      <SourceScaleSection
        analysisError={analysis.error}
        applyCalibration={applyCalibration}
        applySpan={applySpan}
        calibration={calibration}
        level={level}
        manualScale={manualScale}
        page={page}
        planSource={planSource}
        project={project}
        reuseGroundScale={reuseGroundScale}
        setManualScale={setManualScale}
        setMode={setMode}
        setPage={setPage}
        setShowImport={setShowImport}
        showImport={showImport}
      />
    </div>
  )
}
