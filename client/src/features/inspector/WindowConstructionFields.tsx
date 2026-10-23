import type { Wall, WindowUnit } from '../../domain/types'
import { windowConstruction } from '../../domain/windowConstruction'
import { toDisplay, toMetres, type Unit } from '../../geometry/units'
export function WindowConstructionFields({
  window,
  wall,
  unit,
  update,
}: {
  window: WindowUnit
  wall: Wall
  unit: Unit
  update: (change: Record<string, number>) => void
}) {
  const parameters = windowConstruction(window, wall)
  const fields = [
    ['frameWidth', 'Frame section'],
    ['frameDepth', 'Frame depth'],
    ['frameOffset', 'Frame offset in reveal'],
    ['sillProjection', 'Sill projection'],
  ] as const
  return (
    <details>
      <summary>Window construction</summary>
      {fields.map(([key, label]) => (
        <label className="inspector-field" key={key}>
          <span>
            {label} · {unit}
          </span>
          <input
            aria-label={label}
            type="number"
            step={unit === 'm' ? 0.01 : 1}
            value={Number(toDisplay(parameters[key], unit).toFixed(unit === 'm' ? 3 : 0))}
            onChange={(e) => update({ [key]: toMetres(Number(e.target.value), unit) })}
          />
        </label>
      ))}
      {(['mullions', 'transoms'] as const).map((key) => (
        <label className="inspector-field" key={key}>
          <span>{key === 'mullions' ? 'Vertical divisions' : 'Horizontal divisions'}</span>
          <input
            aria-label={key === 'mullions' ? 'Vertical divisions' : 'Horizontal divisions'}
            type="number"
            min="0"
            max="12"
            step="1"
            value={parameters[key]}
            onChange={(e) => update({ [key]: Number(e.target.value) })}
          />
        </label>
      ))}
    </details>
  )
}
