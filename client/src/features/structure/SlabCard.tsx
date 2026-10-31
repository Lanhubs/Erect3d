import type { Level, Selection, Slab } from '../../domain/types'
import {
  axes,
  number,
  outlineRejected,
  outlineUpdated,
  type LevelEdit,
  type VoidSize,
} from './structureRules'
import { SlabOpenings } from './SlabOpenings'

export function SlabCard({
  slab,
  level,
  select,
  apply,
  voidSize,
  setError,
}: {
  slab: Slab
  level: Level
  select: (selection: Selection) => void
  apply: LevelEdit
  voidSize: VoidSize
  setError: (message: string) => void
}) {
  const update = (change: Partial<Slab>) =>
    apply((draft) => {
      const current = draft.slabs?.find((item) => item.id === slab.id)
      if (current) Object.assign(current, change)
    })
  const updateOutline = (index: number, axis: 'x' | 'z', value: number) => {
    const polygon = outlineUpdated(slab.polygon, index, axis, value)
    if (outlineRejected(polygon, slab.openings)) {
      setError('Keep the slab outline valid and around its openings.')
      return
    }
    setError('')
    update({ polygon, autoFromWalls: false })
  }
  return (
    <div className="structure-card">
      <div className="structure-row">
        <b>Slab</b>
        <button onClick={() => select({ kind: 'slab', id: slab.id })}>Inspect</button>
        <button
          onClick={() =>
            apply((draft) => {
              draft.slabs = draft.slabs?.filter((item) => item.id !== slab.id)
              draft.autoSlab = false
            })
          }
          disabled={level.locked}
        >
          Remove
        </button>
      </div>
      <label>
        Thickness (m)
        <input
          type="number"
          min="0.05"
          max="1"
          step="0.01"
          key={`${slab.id}:${slab.thickness}`}
          defaultValue={slab.thickness}
          onBlur={(event) => update({ thickness: Math.max(0.05, number(event.target.value, 0.2)) })}
        />
      </label>
      <label>
        Structure
        <select
          value={slab.structuralMaterial}
          onChange={(event) =>
            update({ structuralMaterial: event.target.value as Slab['structuralMaterial'] })
          }
        >
          <option value="reinforced-concrete">Reinforced concrete</option>
          <option value="concrete">Concrete</option>
          <option value="timber">Timber</option>
          <option value="steel-deck">Steel deck</option>
        </select>
      </label>
      <label>
        Finish
        <select
          value={slab.finishMaterial}
          onChange={(event) => update({ finishMaterial: event.target.value as Slab['finishMaterial'] })}
        >
          {[
            'concrete',
            'polished-concrete',
            'tile',
            'porcelain-tile',
            'marble',
            'timber',
            'laminate',
            'carpet',
          ].map((value) => (
            <option key={value} value={value}>
              {value.replaceAll('-', ' ')}
            </option>
          ))}
        </select>
      </label>
      <details className="structure-outline">
        <summary>Edit slab outline · {slab.polygon.length} vertices</summary>
        {slab.polygon.map((point, index) => (
          <div className="structure-row" key={index}>
            <span>Point {index + 1}</span>
            {axes.map((axis) => (
              <label key={axis}>
                {axis.toUpperCase()}
                <input
                  type="number"
                  step="0.1"
                  key={`${slab.id}:${index}:${axis}:${point[axis]}`}
                  defaultValue={point[axis]}
                  onBlur={(event) => updateOutline(index, axis, number(event.target.value, point[axis]))}
                />
              </label>
            ))}
          </div>
        ))}
      </details>
      <SlabOpenings
        slab={slab}
        locked={level.locked}
        voidSize={voidSize}
        update={update}
        setError={setError}
      />
    </div>
  )
}
