import { type Dispatch, type SetStateAction } from 'react'
import { modelViewAction } from './modelViewAction'
import { useProject, type View } from '../state/project'
import type { Level, SourceDocument } from '../domain/types'
import type { OpeningChoice } from '../geometry/openingCandidates'
import type { useAnalysis } from '../features/import/useAnalysis'
import type { WorkspaceMode } from './WorkspaceHeader'

export function useWorkspaceViews({
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
}: {
  acceptCandidates: (replace: boolean) => void
  analysis: ReturnType<typeof useAnalysis>
  analyzePlan: () => void
  backend: boolean
  level: Level
  onBackendAnalysis?: () => void
  readOnly: boolean
  requestBuild: () => void
  setMode: Dispatch<SetStateAction<WorkspaceMode>>
  setShowImport: Dispatch<SetStateAction<boolean>>
  setWalkRequest: Dispatch<SetStateAction<number>>
  source?: SourceDocument
}) {
  const setView = useProject((s) => s.setView)
  const chooseView = (next: View) => {
    setShowImport(false)
    if (backend && source && !level.walls.length && next !== 'plan') {
      onBackendAnalysis?.()
      return
    }
    const action =
      next !== 'plan' && !readOnly
        ? modelViewAction(analysis.status, analysis.candidates.length, level.walls.length, Boolean(source))
        : 'show'
    if (action === 'build') {
      acceptCandidates(level.walls.length > 0)
      return
    }
    if (action === 'analyze' || action === 'wait') {
      requestBuild()
      if (action === 'analyze') analyzePlan()
      return
    }
    setView(next)
  }
  const setOpeningChoice = (id: string, choice: OpeningChoice) =>
    analysis.setOpeningChoices((current) => ({ ...current, [id]: choice }))
  const walk = () => {
    setMode('edit')
    chooseView('model')
    setWalkRequest((value) => value + 1)
  }
  return { chooseView, setOpeningChoice, walk }
}
