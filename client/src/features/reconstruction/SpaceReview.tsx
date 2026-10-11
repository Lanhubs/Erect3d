import { useEffect, useRef } from 'react'
import type { Point } from '../../domain/types'
import { polygonArea } from '../../geometry/quantities'
import { spaceKey } from '../../geometry/spaceReview'

export function SpaceReview({ spaces, choices, selected, select, setChoice }: {
  spaces: Point[][]; choices: Record<string, boolean>; selected: string | null
  select: (key: string) => void; setChoice: (key: string, include: boolean) => void
}) {
  const popup = useRef<HTMLDetailsElement>(null)
  useEffect(() => { if (selected && popup.current) popup.current.open = true }, [selected])
  const included = spaces.filter(polygon => choices[spaceKey(polygon)] !== false).length
  if (!spaces.length) return null
  return <details className="review-openings review-spaces" ref={popup}>
    <summary>Floors & roofs · {included}/{spaces.length} spaces</summary>
    <div className="review-openings-list">
      <p>Select a space to locate it on the plan. Uncheck courtyards, cabinets or annotation boxes to leave them without a floor or roof. Walls stay editable.</p>
      {spaces.map((polygon, index) => {
        const key = spaceKey(polygon), area = polygonArea(polygon), included = choices[key] !== false
        return <div key={key} className={`space-review-row${selected === key ? ' selected' : ''}`}>
          <label><input type="checkbox" aria-label={`Include space ${index + 1}`} checked={included}
            onChange={event => setChoice(key, event.target.checked)} />
            <button type="button" aria-pressed={selected === key} onClick={() => select(key)}>Space {index + 1} · {area.toFixed(1)} m²</button>
          </label>
          {area < 2 && <small>Small enclosure · check whether this is part of the building.</small>}
        </div>
      })}
    </div>
  </details>
}
