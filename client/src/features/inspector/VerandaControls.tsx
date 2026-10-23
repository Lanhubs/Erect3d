import type { Door, Level, Veranda } from '../../domain/types'
import { newVeranda } from '../../geometry/veranda'
import { useProject } from '../../state/project'
import { toDisplay, toMetres, type Unit } from '../../geometry/units'

export function VerandaControls({ level, door, unit }: { level: Level; door: Door; unit: Unit }) {
  const edit = useProject((state) => state.edit),
    veranda = door.veranda
  const set = (next?: Veranda) => {
    if (!level.locked)
      edit((model) => ({
        ...model,
        doors: model.doors.map((item) => (item.id === door.id ? { ...item, veranda: next } : item)),
      }))
  }
  const change = (value: Partial<Veranda>) => {
    if (veranda) set({ ...veranda, ...value })
  }
  if (!veranda)
    return (
      <button
        className="inspector-action"
        disabled={level.locked}
        onClick={() => set(newVeranda(level, door))}
      >
        Add {level.elevation > 0.5 ? 'upper-floor veranda' : 'entrance veranda'}
      </button>
    )
  return (
    <fieldset className="veranda-controls" disabled={level.locked}>
      <legend>Door veranda · {level.elevation > 0.5 ? 'upper floor' : 'ground floor'}</legend>
      {(['width', 'depth'] as const).map((key) => (
        <label key={key} className="inspector-field">
          <span>
            {key === 'width' ? 'Width' : 'Projection'} · {unit}
          </span>
          <input
            aria-label={`Veranda ${key}`}
            type="number"
            min={toDisplay(key === 'width' ? door.width + 0.3 : 0.6, unit)}
            step={unit === 'm' ? 0.1 : 10}
            value={Number(toDisplay(veranda[key], unit).toFixed(2))}
            onChange={(event) =>
              change({
                [key]: Math.max(
                  key === 'width' ? door.width + 0.3 : 0.6,
                  toMetres(Number(event.target.value), unit),
                ),
              })
            }
          />
        </label>
      ))}
      <label className="inspector-field">
        <span>Outside face</span>
        <select
          value={veranda.side}
          onChange={(event) => change({ side: event.target.value as Veranda['side'] })}
        >
          <option value="left">Left of wall direction</option>
          <option value="right">Right of wall direction</option>
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          checked={veranda.railing}
          onChange={(event) => change({ railing: event.target.checked })}
        />{' '}
        Guardrails on exposed sides
      </label>
      <label>
        <input
          type="checkbox"
          checked={veranda.covered}
          onChange={(event) => change({ covered: event.target.checked })}
        />{' '}
        Covered veranda
      </label>
      {veranda.covered && (
        <label className="inspector-field">
          <span>Cover design</span>
          <select
            value={veranda.roofShape}
            onChange={(event) => change({ roofShape: event.target.value as Veranda['roofShape'] })}
          >
            <option value="shed">Single slope canopy</option>
            <option value="terrace">Flat concrete canopy</option>
          </select>
        </label>
      )}
      <label className="inspector-field">
        <span>Floor finish</span>
        <select
          value={veranda.floorMaterial}
          onChange={(event) => change({ floorMaterial: event.target.value as Veranda['floorMaterial'] })}
        >
          <option value="tile">Tile</option>
          <option value="concrete">Concrete</option>
          <option value="timber">Timber</option>
          <option value="marble">Marble</option>
        </select>
      </label>
      <small>Level with the door threshold. The slab, guardrails and cover follow this door.</small>
      <button className="inspector-action" onClick={() => set(undefined)}>
        Remove veranda
      </button>
    </fieldset>
  )
}
