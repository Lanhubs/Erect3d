import type { OpeningCandidate, OpeningChoice } from '../../geometry/openingCandidates'
import type { ReviewView } from '../plan/ReviewLayer'

export function ReviewPanel({ openings, view, setView, selected, removeWall, setChoice, resolveUnknown }: {
  openings: OpeningCandidate[]; view: ReviewView; setView: (change: Partial<ReviewView>) => void
  selected: string | null; removeWall: () => void; setChoice: (id: string, choice: OpeningChoice) => void; resolveUnknown: () => void
}) {
  const unresolved = openings.filter(item => item.choice === 'unknown').length
  return <section className="review-panel" aria-label="Reconstruction review">
    <div className="review-controls">
      <strong>REVIEW INTERPRETATION</strong>
      <label><input type="checkbox" checked={view.source} onChange={event => setView({ source: event.target.checked })} /> Source</label>
      <label><input type="checkbox" checked={view.walls} onChange={event => setView({ walls: event.target.checked })} /> Walls</label>
      <label><input type="checkbox" checked={view.openings} onChange={event => setView({ openings: event.target.checked })} /> Openings</label>
      <label>Opacity <input aria-label="Source opacity" type="range" min="0.1" max="1" step="0.1" value={view.opacity}
        onChange={event => setView({ opacity: Number(event.target.value) })} /></label>
      <button disabled={!selected} onClick={removeWall}>Delete selected wall</button>
    </div>
    {openings.length > 0 && <details className="review-openings">
      <summary>{unresolved ? `Openings · ${unresolved} need review` : 'Openings · classified'}</summary>
      <div className="review-openings-list">
        {openings.map((item, index) => <label key={item.id}>
          {item.exterior ? 'Exterior' : 'Interior'} {index + 1} · {item.width.toFixed(2)} m
          <select aria-label={`Opening ${index + 1} type`} value={item.choice}
            onChange={event => setChoice(item.id, event.target.value as OpeningChoice)}>
            <option value="unknown">Needs review</option><option value="wall">Continuous wall</option>
            <option value="door">Door</option><option value="window">Window</option><option value="passage">Open passage</option>
          </select>
        </label>)}
        {unresolved > 0 && <button onClick={resolveUnknown}>Treat remaining as walls</button>}
      </div>
    </details>}
  </section>
}
