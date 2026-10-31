import type { Dispatch, SetStateAction } from 'react'
import { ReviewPanel } from '../features/reconstruction/ReviewPanel'
import type { ReviewView } from '../features/plan/ReviewLayer'
import type { OpeningChoice } from '../geometry/openingCandidates'
import type { useAnalysis } from '../features/import/useAnalysis'

export function SourceReviewSection({
  analysis,
  reviewView,
  selectedDetection,
  setOpeningChoice,
  setReviewView,
  setSelectedDetection,
}: {
  analysis: ReturnType<typeof useAnalysis>
  reviewView: ReviewView
  selectedDetection: string | null
  setOpeningChoice: (id: string, choice: OpeningChoice) => void
  setReviewView: Dispatch<SetStateAction<ReviewView>>
  setSelectedDetection: Dispatch<SetStateAction<string | null>>
}) {
  if (analysis.status !== 'completed' || !analysis.candidates.length) return null
  return (
    <ReviewPanel
      openings={analysis.openings}
      rooms={analysis.rooms}
      spaceChoices={analysis.spaceChoices}
      selectedSpace={analysis.selectedSpace}
      selectSpace={analysis.setSelectedSpace}
      setSpaceChoice={(key, include) =>
        analysis.setSpaceChoices((current) => ({ ...current, [key]: include }))
      }
      details={analysis.details}
      detailChoices={analysis.detailChoices}
      report={analysis.report}
      setDetailChoice={(id, include) =>
        analysis.setDetailChoices((current) => ({ ...current, [id]: include }))
      }
      view={reviewView}
      setView={(change) => setReviewView((current) => ({ ...current, ...change }))}
      selected={selectedDetection}
      removeWall={() => {
        analysis.setCandidates((items) => items.filter((item) => item.id !== selectedDetection))
        setSelectedDetection(null)
      }}
      setChoice={setOpeningChoice}
      resolveUnknown={() =>
        analysis.setOpeningChoices((current) => ({
          ...current,
          ...Object.fromEntries(
            analysis.openings.filter((item) => item.choice === 'unknown').map((item) => [item.id, 'wall']),
          ),
        }))
      }
    />
  )
}
