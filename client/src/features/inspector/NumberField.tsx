import { toDisplay, toMetres, type Unit } from '../../geometry/units'
export function NumberField({
  label,
  value,
  onChange,
  unit,
  min = 0,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  unit: Unit
  min?: number
}) {
  return (
    <label className="inspector-field">
      <span>
        {label} · {unit}
      </span>
      <input
        type="number"
        min={toDisplay(min, unit)}
        step={unit === 'm' ? '.01' : '1'}
        value={Number(toDisplay(value, unit).toFixed(unit === 'm' ? 2 : 0))}
        onChange={(event) => onChange(toMetres(Number(event.target.value), unit))}
      />
    </label>
  )
}
