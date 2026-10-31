import { stairPlacementValid } from '../../geometry/stairPlacement'
import type { Level, Project, Selection, Stair } from '../../domain/types'
import { axes, number, stairFieldLabel, stairFieldStep, stairFields } from './structureRules'

export function StairCard({
  stair,
  project,
  level,
  select,
  changeStair,
  repositionStair,
  removeStair,
}: {
  stair: Stair
  project: Project
  level: Level
  select: (selection: Selection) => void
  changeStair: (id: string, change: Partial<Stair>) => void
  repositionStair: (stair: Stair) => void
  removeStair: (stair: Stair) => void
}) {
  const destination = project.buildings[0].levels.find((item) => item.id === stair.toLevelId)
  return (
    <div className="structure-card">
      <div className="structure-row">
        <b>
          {stair.form} stair → {destination?.name}
        </b>
        <button onClick={() => select({ kind: 'stair', id: stair.id })}>Inspect</button>
        <button onClick={() => removeStair(stair)}>Remove</button>
      </div>
      <div className="structure-row">
        <small>
          {stairPlacementValid(stair, project.buildings[0].levels, destination?.slabs || [])
            ? 'Clear route to upper floor'
            : 'Route needs placement'}
        </small>
        <button onClick={() => repositionStair(stair)} disabled={level.locked || destination?.locked}>
          Auto position
        </button>
      </div>
      {axes.map((axis) => (
        <label key={axis}>
          Start {axis.toUpperCase()} · m
          <input
            type="number"
            step="0.1"
            key={`${stair.id}:${axis}:${stair.start[axis]}`}
            defaultValue={stair.start[axis]}
            onBlur={(event) =>
              changeStair(stair.id, {
                start: { ...stair.start, [axis]: number(event.target.value, stair.start[axis]) },
              })
            }
          />
        </label>
      ))}
      {stairFields.map((field) => (
        <label key={field}>
          {stairFieldLabel(field)}
          <input
            type="number"
            step={stairFieldStep(field)}
            key={`${stair.id}:${field}:${stair[field]}`}
            defaultValue={stair[field]}
            onBlur={(event) => changeStair(stair.id, { [field]: number(event.target.value, stair[field]) })}
          />
        </label>
      ))}
    </div>
  )
}
