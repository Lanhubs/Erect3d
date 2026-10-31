import { useCallback, type Dispatch, type SetStateAction } from 'react'
import { activeLevel, type Calibration, type Level, type Selection } from '../domain/types'
import { setLevelCalibration } from '../domain/levelCalibration'
import { saveProject } from '../state/database'
import { useProject } from '../state/project'
import type { WorkspaceMode } from './WorkspaceHeader'
import type { PanelId } from './WorkspacePanels'

export const elementOwner = (levels: Level[], id: string) =>
  levels.find((item) =>
    [
      item.walls,
      item.doors,
      item.windows,
      item.passages,
      item.rooms,
      item.slabs,
      item.columns,
      item.stairs,
      item.ramps,
      item.seatingSections,
      item.details,
      item.furniture,
    ].some((items) => items?.some((element) => element.id === id)),
  )

export function useWorkspaceActions({
  levelId,
  panel,
  previewing,
  setMode,
  setPanel,
  sourceId,
}: {
  levelId: string
  panel: PanelId | null
  previewing: boolean
  setMode: Dispatch<SetStateAction<WorkspaceMode>>
  setPanel: Dispatch<SetStateAction<PanelId | null>>
  sourceId?: string
}) {
  const select = useProject((s) => s.setSelection),
    setProject = useProject((s) => s.replaceDocument)
  const inspectorOpen = panel === 'properties'
  const setInspectorOpen = (next: boolean | ((before: boolean) => boolean)) =>
    setPanel((typeof next === 'function' ? next(inspectorOpen) : next) ? 'properties' : null)
  const exitPresentation = useCallback(() => setMode('edit'), [setMode])
  const selectEntity = useCallback(
    (next: Selection) => {
      if (previewing) return
      const state = useProject.getState(),
        owner = next && elementOwner(state.project?.buildings[0].levels || [], next.id)
      if (owner && owner.id !== state.activeLevelId) state.setActiveLevel(owner.id)
      select(next)
      if (next) setPanel('properties')
    },
    [select, previewing, setPanel],
  )
  const saveAutoScale = useCallback(
    (estimate: Calibration) => {
      const current = useProject.getState().project
      if (
        !current ||
        useProject.getState().readOnly ||
        activeLevel(current, levelId).sourceId !== sourceId ||
        activeLevel(current, levelId).calibration?.method === 'manual'
      )
        return
      const copy = setLevelCalibration(current, levelId, estimate)
      setProject(copy)
      void saveProject(copy)
    },
    [sourceId, setProject, levelId],
  )
  return { exitPresentation, inspectorOpen, saveAutoScale, selectEntity, setInspectorOpen }
}
