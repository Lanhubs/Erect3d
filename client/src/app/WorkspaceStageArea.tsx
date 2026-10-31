import { Suspense, lazy, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { BuildingAnalysis } from '../features/analysis/BuildingAnalysis'
import { PlanEditor } from '../features/plan/PlanEditor'
import type { ReviewView } from '../features/plan/ReviewLayer'
import type { PlanSourceRect } from '../features/plan/planBounds'
import type { Level, Project, Selection } from '../domain/types'
import { LoadingState } from './LoadingState'
import { WorkspaceStage } from './WorkspaceStage'
import { WorkspaceStatus } from './WorkspaceStatus'
import type { PanelId } from './WorkspacePanels'
import type { useAnalysis } from '../features/import/useAnalysis'
import type { View } from '../state/project'
import type { WorkspaceMode } from './WorkspaceHeader'

const Viewer = lazy(() => import('../rendering/Viewer').then((module) => ({ default: module.Viewer })))

export function WorkspaceStageArea({
  analysis,
  exitPresentation,
  isolateId,
  level,
  mode,
  previewControls,
  previewing,
  project,
  reviewView,
  roofShown,
  selectedDetection,
  selectEntity,
  selection,
  setPanel,
  setRoofShown,
  setSelectedDetection,
  setWalking,
  sourceRect,
  statusContent,
  underlay,
  view,
  walkRequest,
  warning,
  wholeBuildingRequest,
}: {
  analysis: ReturnType<typeof useAnalysis>
  exitPresentation: () => void
  isolateId: string | null
  level: Level
  mode: WorkspaceMode
  previewControls?: ReactNode
  previewing: boolean
  project: Project
  reviewView: ReviewView
  roofShown: boolean
  selectedDetection: string | null
  selectEntity: (next: Selection) => void
  selection: Selection
  setPanel: Dispatch<SetStateAction<PanelId | null>>
  setRoofShown: Dispatch<SetStateAction<boolean>>
  setSelectedDetection: Dispatch<SetStateAction<string | null>>
  setWalking: Dispatch<SetStateAction<boolean>>
  sourceRect?: PlanSourceRect
  statusContent?: ReactNode
  underlay?: Level
  view: View
  walkRequest: number
  warning: boolean
  wholeBuildingRequest?: string
}) {
  return (
    <>
      {previewControls}
      <WorkspaceStage
        view={view}
        mode={mode}
        analysis={<BuildingAnalysis building={project.buildings[0]} active={level} unit={project.units} />}
        plan={
          <PlanEditor
            level={level}
            selection={previewing ? null : selection}
            select={selectEntity}
            previewOnly={previewing}
            unit={project.units}
            source={sourceRect}
            underlay={underlay}
            fence={
              level.id === project.buildings[0].levels[0].id ? project.buildings[0].siteFence : undefined
            }
            review={
              analysis.status === 'completed' && analysis.candidates.length > 0
                ? {
                    candidates: analysis.candidates,
                    openings: analysis.openings,
                    view: reviewView,
                    selected: selectedDetection,
                    rooms: analysis.rooms,
                    spaceChoices: analysis.spaceChoices,
                    selectedSpace: analysis.selectedSpace,
                    selectSpace: analysis.setSelectedSpace,
                    details: analysis.details,
                    detailChoices: analysis.detailChoices,
                    setSelected: setSelectedDetection,
                    setCandidates: analysis.setCandidates,
                  }
                : undefined
            }
          />
        }
        viewer={
          <Suspense
            fallback={<LoadingState label="Preparing your model" detail="Loading the 3D workspace." />}
          >
            <Viewer
              building={project.buildings[0]}
              wholeBuildingRequest={wholeBuildingRequest}
              activeLevelId={level.id}
              isolateId={isolateId}
              selection={mode === 'present' || previewing ? null : selection}
              select={selectEntity}
              previewOnly={previewing}
              roofShown={roofShown}
              setRoofShown={setRoofShown}
              walkRequest={walkRequest}
              onWalkChange={setWalking}
              active={mode !== 'analyze' && (mode === 'present' || view !== 'plan')}
              presentation={mode === 'present'}
              onExitPresentation={exitPresentation}
            />
          </Suspense>
        }
      />
      <WorkspaceStatus
        level={level}
        units={project.units}
        extra={statusContent}
        onLevels={() => setPanel('levels')}
        attention={
          warning && (
            <button onClick={() => setPanel('source')} className="source-attention" role="status">
              Source needs attention
            </button>
          )
        }
      />
    </>
  )
}
