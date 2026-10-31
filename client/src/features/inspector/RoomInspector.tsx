import type { Room } from '../../domain/types'
import { roomArea, roomPerimeter } from '../../geometry/math'
import { formatArea, formatDistance, type Unit } from '../../geometry/units'
import { NumberField } from './NumberField'
import { floorMaterials } from './inspectorMaterials'

export function RoomInspector({
  room,
  unit,
  change,
}: {
  room: Room
  unit: Unit
  change: (values: Record<string, string | number>) => void
}) {
  return (
    <div className="fields">
      <label className="inspector-field">
        <span>Name</span>
        <input value={room.name} onChange={(event) => change({ name: event.target.value })} />
      </label>
      <div className="readout">
        <span>Area</span>
        <b>{formatArea(roomArea(room), unit)}</b>
      </div>
      <div className="readout">
        <span>Perimeter</span>
        <b>{formatDistance(roomPerimeter(room), unit)}</b>
      </div>
      <NumberField
        label="Ceiling"
        unit={unit}
        value={room.ceilingHeight || 2.9}
        min={2}
        onChange={(ceilingHeight) => change({ ceilingHeight })}
      />
      <label className="inspector-field">
        <span>Floor finish</span>
        <select value={room.material} onChange={(event) => change({ material: event.target.value })}>
          {floorMaterials.map((item) => (
            <option key={item} value={item}>
              {item.replace('-', ' ')}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
