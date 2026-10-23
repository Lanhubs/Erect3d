import { uid, type Door, type Level, type Passage, type WindowUnit } from '../../domain/types'
import { validateOpening } from '../../geometry/openingValidation'
import { toDisplay, toMetres, type Unit } from '../../geometry/units'
import { useProject } from '../../state/project'
import { VerandaControls } from './VerandaControls'
import { WindowConstructionFields } from './WindowConstructionFields'

function NumberField({
  label,
  value,
  min = 0,
  unit,
  onChange,
}: {
  label: string
  value: number
  min?: number
  unit: Unit
  onChange: (value: number) => void
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

export function OpeningInspector({
  level,
  door,
  windowUnit,
  passage,
  unit,
  update,
  setValidation,
}: {
  level: Level
  door?: Door
  windowUnit?: WindowUnit
  passage?: Passage
  unit: Unit
  update: (kind: 'doors' | 'windows' | 'passages', change: Record<string, string | number>) => void
  setValidation: (message: string) => void
}) {
  const edit = useProject((state) => state.edit),
    select = useProject((state) => state.setSelection)
  return (
    <>
      {door && (
        <div className="fields">
          <VerandaControls level={level} door={door} unit={unit} />
          <div className="readout">
            <span>Host wall</span>
            <b>{door.wallId}</b>
          </div>
          <label className="inspector-field">
            <span>Door design</span>
            <select
              aria-label="Door design"
              value={door.style || 'flush'}
              onChange={(event) =>
                update('doors', {
                  style: event.target.value,
                  ...(event.target.value === 'sectional' && !door.material ? { material: 'metal' } : {}),
                })
              }
            >
              <option value="flush">Flush</option>
              <option value="panel">Panel</option>
              <option value="glazed">Glazed</option>
              <option value="double">Double leaf</option>
              <option value="sectional">Sectional garage</option>
            </select>
          </label>
          {door.style === 'double' && (
            <label className="inspector-field">
              <span>Leaf construction</span>
              <select
                aria-label="Door leaf construction"
                value={door.leafStyle || 'panel'}
                onChange={(e) => update('doors', { leafStyle: e.target.value })}
              >
                <option value="flush">Flush</option>
                <option value="panel">Panel</option>
                <option value="glazed">Glazed</option>
              </select>
            </label>
          )}
          {door.style !== 'sectional' && (
            <>
              <label className="inspector-field">
                <span>Hinge side</span>
                <select
                  aria-label="Hinge side"
                  value={door.hinge}
                  onChange={(event) => update('doors', { hinge: event.target.value })}
                >
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </select>
              </label>
              <label className="inspector-field">
                <span>Opening</span>
                <select
                  aria-label="Door opening direction"
                  value={door.swing || 'in'}
                  onChange={(event) => update('doors', { swing: event.target.value })}
                >
                  <option value="in">Into room</option>
                  <option value="out">Outward</option>
                </select>
              </label>
            </>
          )}
          <label className="inspector-field">
            <span>Door material</span>
            <select
              aria-label="Door material"
              value={door.material || (door.style === 'sectional' ? 'metal' : 'timber')}
              onChange={(event) => update('doors', { material: event.target.value })}
            >
              <option value="timber">Timber</option>
              <option value="metal">Metal</option>
            </select>
          </label>
          <NumberField
            label="Offset"
            unit={unit}
            value={door.offset}
            onChange={(offset) => update('doors', { offset })}
          />
          <NumberField
            label="Width"
            unit={unit}
            value={door.width}
            min={0.4}
            onChange={(width) => update('doors', { width })}
          />
          <NumberField
            label="Height"
            unit={unit}
            value={door.height}
            min={1.5}
            onChange={(height) => update('doors', { height })}
          />
          <button
            className="inspector-action"
            onClick={() => {
              const next = { ...door, id: uid('door'), offset: door.offset + door.width + 0.15 }
              const issue = validateOpening(level, next)
              if (issue) setValidation(issue)
              else edit((model) => ({ ...model, doors: [...model.doors, next] }))
            }}
          >
            Duplicate door
          </button>
          <button
            className="inspector-action"
            onClick={() => {
              const id = uid('window')
              edit((model) => ({
                ...model,
                doors: model.doors.filter((item) => item.id !== door.id),
                windows: [
                  ...model.windows,
                  {
                    id,
                    wallId: door.wallId,
                    offset: door.offset,
                    width: door.width,
                    height: 1.2,
                    sill: 0.85,
                  },
                ],
              }))
              select({ kind: 'window', id })
            }}
          >
            Convert to window
          </button>
          <button
            className="inspector-action"
            onClick={() => {
              const id = uid('passage')
              edit((model) => ({
                ...model,
                doors: model.doors.filter((item) => item.id !== door.id),
                passages: [
                  ...model.passages,
                  { id, wallId: door.wallId, offset: door.offset, width: door.width, height: door.height },
                ],
              }))
              select({ kind: 'passage', id })
            }}
          >
            Convert to open passage
          </button>
        </div>
      )}
      {windowUnit && (
        <div className="fields">
          {level.walls.find((w) => w.id === windowUnit.wallId) && (
            <WindowConstructionFields
              window={windowUnit}
              wall={level.walls.find((w) => w.id === windowUnit.wallId)!}
              unit={unit}
              update={(change) => update('windows', change)}
            />
          )}
          <div className="readout">
            <span>Host wall</span>
            <b>{windowUnit.wallId}</b>
          </div>
          <label className="inspector-field">
            <span>Frame</span>
            <select
              aria-label="Window frame"
              value={windowUnit.frame || 'aluminium'}
              onChange={(event) => update('windows', { frame: event.target.value })}
            >
              <option value="aluminium">Aluminium</option>
              <option value="timber">Timber</option>
            </select>
          </label>
          <label className="inspector-field">
            <span>Window type</span>
            <select
              aria-label="Window type"
              value={windowUnit.type || 'sliding'}
              onChange={(event) => update('windows', { type: event.target.value })}
            >
              <option value="fixed">Fixed</option>
              <option value="sliding">Sliding</option>
              <option value="casement">Casement</option>
            </select>
          </label>
          <label className="inspector-field">
            <span>Glazing</span>
            <select
              aria-label="Window glazing"
              value={windowUnit.glazing || 'clear'}
              onChange={(event) => update('windows', { glazing: event.target.value })}
            >
              <option value="clear">Clear</option>
              <option value="frosted">Frosted</option>
            </select>
          </label>
          <NumberField
            label="Offset"
            unit={unit}
            value={windowUnit.offset}
            onChange={(offset) => update('windows', { offset })}
          />
          <NumberField
            label="Width"
            unit={unit}
            value={windowUnit.width}
            min={0.3}
            onChange={(width) => update('windows', { width })}
          />
          <NumberField
            label="Height"
            unit={unit}
            value={windowUnit.height}
            min={0.3}
            onChange={(height) => update('windows', { height })}
          />
          <NumberField
            label="Sill"
            unit={unit}
            value={windowUnit.sill}
            onChange={(sill) => update('windows', { sill })}
          />
          <button
            className="inspector-action"
            onClick={() => {
              const id = uid('door')
              edit((model) => ({
                ...model,
                windows: model.windows.filter((item) => item.id !== windowUnit.id),
                doors: [
                  ...model.doors,
                  {
                    id,
                    wallId: windowUnit.wallId,
                    offset: windowUnit.offset,
                    width: windowUnit.width,
                    height: 2.1,
                    hinge: 'left',
                  },
                ],
              }))
              select({ kind: 'door', id })
            }}
          >
            Convert to door
          </button>
        </div>
      )}
      {passage && (
        <div className="fields">
          <div className="readout">
            <span>Host wall</span>
            <b>{passage.wallId}</b>
          </div>
          <NumberField
            label="Offset"
            unit={unit}
            value={passage.offset}
            onChange={(offset) => update('passages', { offset })}
          />
          <NumberField
            label="Width"
            unit={unit}
            value={passage.width}
            min={0.3}
            onChange={(width) => update('passages', { width })}
          />
          <NumberField
            label="Height"
            unit={unit}
            value={passage.height}
            min={1.5}
            onChange={(height) => update('passages', { height })}
          />
        </div>
      )}
    </>
  )
}
