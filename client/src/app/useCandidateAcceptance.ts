import { useCallback, type Dispatch, type SetStateAction } from 'react'
import { acceptInterpretation } from '../domain/acceptInterpretation'
import { acceptFurniture } from '../furniture/acceptance'
import { useFurnitureReview } from '../furniture/reviewState'
import { useProject } from '../state/project'
import type { useAnalysis } from '../features/import/useAnalysis'

export function useCandidateAcceptance({
  analysis,
  levelId,
  levelLocked,
  setRoofShown,
  setShowImport,
  sourceId,
}: {
  analysis: ReturnType<typeof useAnalysis>
  levelId: string
  levelLocked?: boolean
  setRoofShown: Dispatch<SetStateAction<boolean>>
  setShowImport: Dispatch<SetStateAction<boolean>>
  sourceId?: string
}) {
  const editProject = useProject((s) => s.editProject),
    setTool = useProject((s) => s.setTool),
    setView = useProject((s) => s.setView)
  return useCallback(
    (replace: boolean) => {
      if (useProject.getState().readOnly) return
      editProject((copy) => {
        acceptInterpretation(
          copy,
          levelId,
          analysis.candidates,
          analysis.openings,
          analysis.details.filter((detail) => analysis.detailChoices[detail.id]),
          replace,
          analysis.spaceChoices,
        )
        const review = useFurnitureReview.getState(),
          building = copy.buildings[0]
        if (review.key === `${levelId}:${sourceId || ''}`)
          acceptFurniture(
            building.levels.find((item) => item.id === levelId)!,
            review.candidates,
            building.levels,
          )
        return copy
      })
      if (!levelLocked && useFurnitureReview.getState().key === `${levelId}:${sourceId || ''}`)
        useFurnitureReview.getState().consumeAccepted()
      analysis.clear()
      setShowImport(false)
      setRoofShown(false)
      setView('model')
      setTool('select')
    },
    [analysis, editProject, setView, setTool, setRoofShown, setShowImport, levelId, levelLocked, sourceId],
  )
}
