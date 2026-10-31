import type { Ramp } from '../../domain/types'
import { useProject } from '../../state/project'
import { formatDistance, type Unit } from '../../geometry/units'
import { NumberField } from './NumberField'
import { rampRun, rampSlope } from './inspectorRules'

export function RampInspector({ ramp, unit }: { ramp: Ramp; unit: Unit }) {
  const edit = useProject((s) => s.edit)
  const run = rampRun(ramp)
  return (
    <div className="fields">
      <div className="readout">
        <span>Run</span>
        <b>{formatDistance(run, unit)}</b>
      </div>
      <div className="readout">
        <span>Slope</span>
        <b>{rampSlope(ramp).toFixed(1)}%</b>
      </div>
      {(['start', 'end'] as const).flatMap((pointName) =>
        (['x', 'z'] as const).map((axis) => (
          <NumberField
            key={`${pointName}:${axis}`}
            label={`${pointName} ${axis.toUpperCase()}`}
            unit={unit}
            value={ramp[pointName][axis]}
            onChange={(value) =>
              edit((model) => ({
                ...model,
                ramps: model.ramps.map((item) =>
                  item.id === ramp.id
                    ? { ...item, [pointName]: { ...item[pointName], [axis]: value } }
                    : item,
                ),
              }))
            }
          />
        )),
      )}
      <NumberField
        label="Width"
        unit={unit}
        value={ramp.width}
        min={0.4}
        onChange={(width) =>
          edit((model) => ({
            ...model,
            ramps: model.ramps.map((item) =>
              item.id === ramp.id ? { ...item, width: Math.max(0.4, width) } : item,
            ),
          }))
        }
      />
      <NumberField
        label="Thickness"
        unit={unit}
        value={ramp.thickness}
        min={0.05}
        onChange={(thickness) =>
          edit((model) => ({
            ...model,
            ramps: model.ramps.map((item) =>
              item.id === ramp.id ? { ...item, thickness: Math.max(0.05, thickness) } : item,
            ),
          }))
        }
      />
      <NumberField
        label="Start elevation"
        unit={unit}
        value={ramp.startElevation}
        onChange={(startElevation) =>
          edit((model) => ({
            ...model,
            ramps: model.ramps.map((item) => (item.id === ramp.id ? { ...item, startElevation } : item)),
          }))
        }
      />
      <NumberField
        label="End elevation"
        unit={unit}
        value={ramp.endElevation}
        onChange={(endElevation) =>
          edit((model) => ({
            ...model,
            ramps: model.ramps.map((item) => (item.id === ramp.id ? { ...item, endElevation } : item)),
          }))
        }
      />
      <label className="inspector-field">
        <span>Material</span>
        <select
          value={ramp.material}
          onChange={(event) =>
            edit((model) => ({
              ...model,
              ramps: model.ramps.map((item) =>
                item.id === ramp.id
                  ? { ...item, material: event.target.value as typeof item.material }
                  : item,
              ),
            }))
          }
        >
          <option value="reinforced-concrete">Reinforced concrete</option>
          <option value="concrete">Concrete</option>
          <option value="timber">Timber</option>
          <option value="steel-deck">Steel deck</option>
        </select>
      </label>
    </div>
  )
}
