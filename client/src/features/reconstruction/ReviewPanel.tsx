import type { OpeningCandidate, OpeningChoice } from '../../geometry/openingCandidates'
import type { ReviewView } from '../plan/ReviewLayer'
import type { PlanDetail } from '../../domain/interpretationTypes'
import type { PlanAnalysisResult } from '../../workers/analyze'
import type { Point } from '../../domain/types'
import { SpaceReview } from './SpaceReview'

export function ReviewPanel({
  openings,
  view,
  setView,
  selected,
  removeWall,
  setChoice,
  resolveUnknown,
  rooms = [],
  spaceChoices,
  selectedSpace,
  selectSpace,
  setSpaceChoice,
  details = [],
  detailChoices = {},
  setDetailChoice,
  report,
}: {
  openings: OpeningCandidate[]
  view: ReviewView
  setView: (change: Partial<ReviewView>) => void
  selected: string | null
  removeWall: () => void
  setChoice: (id: string, choice: OpeningChoice) => void
  resolveUnknown: () => void
  rooms?: Point[][]
  spaceChoices: Record<string, boolean>
  selectedSpace: string | null
  selectSpace: (key: string) => void
  setSpaceChoice: (key: string, include: boolean) => void
  details?: PlanDetail[]
  detailChoices?: Record<string, boolean>
  setDetailChoice?: (id: string, include: boolean) => void
  report?: PlanAnalysisResult['report'] | null
}) {
  const unresolved = openings.filter((item) => item.choice === 'unknown').length
  return (
    <section className="review-panel" aria-label="Reconstruction review">
      <div className="review-controls">
        <strong>REVIEW INTERPRETATION</strong>
        <label>
          <input
            type="checkbox"
            checked={view.source}
            onChange={(event) => setView({ source: event.target.checked })}
          />{' '}
          Source
        </label>
        <label>
          <input
            type="checkbox"
            checked={view.walls}
            onChange={(event) => setView({ walls: event.target.checked })}
          />{' '}
          Walls
        </label>
        <label>
          <input
            type="checkbox"
            checked={view.openings}
            onChange={(event) => setView({ openings: event.target.checked })}
          />{' '}
          Openings
        </label>
        <label>
          <input
            type="checkbox"
            checked={Boolean(view.spaces)}
            onChange={(event) => setView({ spaces: event.target.checked })}
          />{' '}
          Spaces
        </label>
        <label>
          <input
            type="checkbox"
            checked={Boolean(view.details)}
            onChange={(event) => setView({ details: event.target.checked })}
          />{' '}
          Details
        </label>
        <label>
          Opacity{' '}
          <input
            aria-label="Source opacity"
            type="range"
            min="0.1"
            max="1"
            step="0.1"
            value={view.opacity}
            onChange={(event) => setView({ opacity: Number(event.target.value) })}
          />
        </label>
        <button disabled={!selected} onClick={removeWall}>
          Delete selected wall
        </button>
      </div>
      {openings.length > 0 && (
        <details className="review-openings">
          <summary>{unresolved ? `Openings · ${unresolved} need review` : 'Openings · classified'}</summary>
          <div className="review-openings-list">
            {openings.map((item, index) => (
              <label key={item.id} title={item.evidence}>
                {item.exterior ? 'Exterior' : 'Interior'} {index + 1} · {item.width.toFixed(2)} m
                <select
                  aria-label={`Opening ${index + 1} type`}
                  value={item.choice}
                  onChange={(event) => setChoice(item.id, event.target.value as OpeningChoice)}
                >
                  <option value="unknown">Needs review</option>
                  <option value="wall">Continuous wall</option>
                  <option value="door">Door</option>
                  <option value="window">Window</option>
                  <option value="passage">Open passage</option>
                </select>
              </label>
            ))}
            {unresolved > 0 && <button onClick={resolveUnknown}>Treat remaining as walls</button>}
          </div>
        </details>
      )}
      <SpaceReview
        spaces={rooms}
        choices={spaceChoices}
        selected={selectedSpace}
        select={selectSpace}
        setChoice={setSpaceChoice}
      />
      <details className="review-openings interpretation-details">
        <summary>
          Interpretation · {rooms.length} spaces · {details.length} details
        </summary>
        <div className="review-openings-list">
          <p>Spaces follow closed wall boundaries. Outdoor gaps stay outside the floor footprint.</p>
          {report?.smallRaster && (
            <p>
              This image is small for a detailed plan. Tiny text and fixture symbols may be unreadable; use
              the original PDF or a larger image for more detail.
            </p>
          )}
          {report && (report.featureLimitReached || report.wallLimitReached) && (
            <p>
              The analysis limit was reached. Review missing details or import one building wing at a time.
            </p>
          )}
          <p>
            Scale is an estimate unless verified against a dimension. Roof form, storey height and furniture
            are not specified by the detected lines.
          </p>
          {details.map((detail, index) => (
            <div className="interpretation-detail" key={detail.id}>
              <label>
                <input
                  type="checkbox"
                  aria-label={`Include ${detail.kind} ${index + 1}`}
                  checked={Boolean(detailChoices[detail.id])}
                  onChange={(event) => setDetailChoice?.(detail.id, event.target.checked)}
                />
                {detail.kind === 'stair' ? 'Stair footprint' : 'Column'} {index + 1} ·{' '}
                {Math.round(detail.confidence * 100)}% confidence
              </label>
              <small>{detail.evidence}</small>
            </div>
          ))}
          {details.some((detail) => detail.kind === 'stair') && (
            <p>
              Stair footprints are preserved in the plan. Connect them to an upper level in Structure after
              checking direction and flight form.
            </p>
          )}
        </div>
      </details>
    </section>
  )
}
