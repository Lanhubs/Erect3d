import type { SeatingSection } from '../../domain/types'
import { useProject } from '../../state/project'
import type { Unit } from '../../geometry/units'
import { NumberField } from './NumberField'
import { fanGrowth, seatingCount, seatingStep } from './inspectorRules'

export function SeatingInspector({ seating, unit }: { seating: SeatingSection; unit: Unit }) {
  const edit = useProject((s) => s.edit)
  return (
    <div className="fields">
      <label className="inspector-field">
        <span>Section name</span>
        <input
          value={seating.name}
          onChange={(event) =>
            edit((model) => ({
              ...model,
              seatingSections: model.seatingSections.map((item) =>
                item.id === seating.id ? { ...item, name: event.target.value } : item,
              ),
            }))
          }
        />
      </label>
      {(['start', 'end', 'outward'] as const).flatMap((pointName) =>
        (['x', 'z'] as const).map((axis) => (
          <NumberField
            key={`${pointName}:${axis}`}
            label={`${pointName} ${axis.toUpperCase()}`}
            unit={unit}
            value={seating[pointName][axis]}
            onChange={(value) =>
              edit((model) => ({
                ...model,
                seatingSections: model.seatingSections.map((item) =>
                  item.id === seating.id
                    ? { ...item, [pointName]: { ...item[pointName], [axis]: value } }
                    : item,
                ),
              }))
            }
          />
        )),
      )}
      {(['rows', 'seatsPerRow'] as const).map((field) => (
        <label key={field} className="inspector-field">
          <span>{field === 'rows' ? 'Rows' : 'Seats / row'}</span>
          <input
            aria-label={field === 'rows' ? 'Seating rows' : 'Seats per row'}
            type="number"
            min="1"
            step="1"
            value={seating[field]}
            onChange={(event) =>
              edit((model) => ({
                ...model,
                seatingSections: model.seatingSections.map((item) =>
                  item.id === seating.id
                    ? { ...item, [field]: seatingCount(Number(event.target.value)) }
                    : item,
                ),
              }))
            }
          />
        </label>
      ))}
      {(['rowDepth', 'rowRise'] as const).map((field) => (
        <NumberField
          key={field}
          label={field === 'rowDepth' ? 'Row depth' : 'Rise per row'}
          unit={unit}
          value={seating[field]}
          min={0.05}
          onChange={(value) =>
            edit((model) => ({
              ...model,
              seatingSections: model.seatingSections.map((item) =>
                item.id === seating.id ? { ...item, [field]: seatingStep(value) } : item,
              ),
            }))
          }
        />
      ))}
      <NumberField
        label="Fan width growth / row"
        unit={unit}
        value={seating.rowWidthGrowth || 0}
        min={0}
        onChange={(value) =>
          edit((model) => ({
            ...model,
            seatingSections: model.seatingSections.map((item) =>
              item.id === seating.id ? { ...item, rowWidthGrowth: fanGrowth(value) } : item,
            ),
          }))
        }
      />
      <label className="inspector-field">
        <span>Base elevation · m</span>
        <input
          type="number"
          step="0.1"
          value={seating.baseElevation}
          onChange={(event) =>
            edit((model) => ({
              ...model,
              seatingSections: model.seatingSections.map((item) =>
                item.id === seating.id ? { ...item, baseElevation: Number(event.target.value) } : item,
              ),
            }))
          }
        />
      </label>
      <label className="inspector-field">
        <span>Seat color</span>
        <input
          type="color"
          value={seating.seatColor}
          onChange={(event) =>
            edit((model) => ({
              ...model,
              seatingSections: model.seatingSections.map((item) =>
                item.id === seating.id ? { ...item, seatColor: event.target.value } : item,
              ),
            }))
          }
        />
      </label>
    </div>
  )
}
