import { useState } from 'react'
import type { Level, Selection } from '../../domain/types'
import { uid } from '../../domain/types'
import { roomArea, roomPerimeter, wallLength } from '../../geometry/math'
import { resizeWall, rotateWall, splitPosition, splitWall, wallAngle } from '../../geometry/editWall'
import { useProject } from '../../state/project'
import { materialColor } from '../../rendering/materials'
import { formatArea, formatDistance, toDisplay, toMetres, type Unit } from '../../geometry/units'
import { RoofControls } from './RoofControls'
import { validateOpening } from '../../geometry/openingValidation'
import { StructureInspector } from './StructureInspector'

const materials = Object.keys(materialColor)
const wallMaterials = materials.filter(item => !['marble', 'carpet', 'polished-concrete'].includes(item))
const floorMaterials = ['tile', 'porcelain-tile', 'oak', 'timber', 'laminate', 'marble', 'carpet', 'polished-concrete', 'concrete']
function NumberField({ label, value, onChange, unit, min = 0 }: {
  label: string; value: number; onChange: (value: number) => void; unit: Unit; min?: number
}) {
  return <label className="inspector-field"><span>{label} · {unit}</span>
    <input type="number" min={toDisplay(min, unit)} step={unit === 'm' ? '.01' : '1'}
      value={Number(toDisplay(value, unit).toFixed(unit === 'm' ? 2 : 0))}
      onChange={event => onChange(toMetres(Number(event.target.value), unit))} />
  </label>
}
export function Inspector({ level, selection, unit, open, onClose }: { level: Level; selection: Selection; unit: Unit; open?: boolean; onClose?: () => void }) {
  const [validation, setValidation] = useState('')
  const edit = useProject(s => s.edit), select = useProject(s => s.setSelection)
  const shell = `inspector${open ? ' mobile-open' : ''}`
  const mobileHead = <div className="inspector-mobile-head"><strong>{selection ? `${selection.kind} properties` : 'Properties'}</strong><button type="button" onClick={onClose} aria-label="Close properties">×</button></div>
  if (!selection) return <aside className={shell}>
    {mobileHead}
    <div className="panel-title">PROPERTIES</div>
    <div className="inspector-empty">Select a wall, opening, or room to edit its properties.</div>
    <div className="panel-title">LEVEL SUMMARY</div>
    <div className="summary-grid"><span>Walls</span><b>{level.walls.length}</b>
      <span>Doors</span><b>{level.doors.length}</b>
      <span>Windows</span><b>{level.windows.length}</b>
      <span>Rooms</span><b>{level.rooms.length}</b></div>
    <RoofControls level={level} />
  </aside>
  if (selection.kind === 'slab' || selection.kind === 'column' || selection.kind === 'stair')
    return <StructureInspector level={level} selection={selection} unit={unit} open={open} onClose={onClose} />
  const update = (kind: 'walls' | 'doors' | 'windows' | 'passages' | 'rooms', change: Record<string, string | number>) => {
    if (kind === 'doors' || kind === 'windows' || kind === 'passages') {
      const previous = (level[kind] || []).find(item => item.id === selection.id)
      if (previous) {
        const issue = validateOpening(level, { ...previous, ...change })
        if (issue) { setValidation(issue); return }
      }
    }
    setValidation('')
    edit(model => ({ ...model, [kind]: model[kind].map(item =>
      item.id === selection.id ? { ...item, ...change } : item) }))
  }
  const remove = () => {
    edit(model => ({
      roof: model.roof,
      walls: model.walls.filter(item => item.id !== selection.id),
      doors: model.doors.filter(item => item.id !== selection.id && item.wallId !== selection.id),
      windows: model.windows.filter(item => item.id !== selection.id && item.wallId !== selection.id),
      passages: model.passages.filter(item => item.id !== selection.id && item.wallId !== selection.id),
      rooms: model.rooms.filter(item => item.id !== selection.id),
    }))
    select(null)
  }
  const wall = level.walls.find(item => item.id === selection.id)
  const door = level.doors.find(item => item.id === selection.id)
  const windowUnit = level.windows.find(item => item.id === selection.id)
  const passage = (level.passages || []).find(item => item.id === selection.id)
  const room = level.rooms.find(item => item.id === selection.id)
  const minimumWallLength = wall ? Math.max(.1, ...[...level.doors, ...level.windows, ...(level.passages || [])]
    .filter(item => item.wallId === wall.id).map(item => item.offset + item.width + .05)) : .1
  return <aside className={shell}>
    {mobileHead}
    <div className="panel-title">PROPERTIES</div>
    <div className="entity-title"><strong>{selection.kind.toUpperCase()}</strong><small>{selection.id}</small></div>
    {validation && <div className="inline-error" role="alert">{validation}</div>}
    {wall && <div className="fields">
      <NumberField label="Length" unit={unit} value={wallLength(wall)} min={minimumWallLength}
        onChange={length => edit(model => ({ ...model, walls: model.walls.map(item => item.id === wall.id
          ? resizeWall(item, Math.max(minimumWallLength, length)) : item) }))} />
      <label className="inspector-field"><span>Angle · °</span><input aria-label="Wall angle" type="number" step="1"
        value={Number(wallAngle(wall).toFixed(1))} onChange={event => edit(model => ({ ...model,
          walls: model.walls.map(item => item.id === wall.id ? rotateWall(item, Number(event.target.value)) : item) }))} /></label>
      <label className="inspector-field"><span>Wall type</span>
        <select aria-label="Wall type" value={wall.kind || (wall.thickness >= .25 ? 'exterior' : 'interior')}
          onChange={event => update('walls', { kind: event.target.value })}>
          <option value="exterior">Exterior</option><option value="interior">Interior</option><option value="partition">Partition</option>
        </select></label>
      <NumberField label="Thickness" unit={unit} value={wall.thickness} min={.05} onChange={thickness => update('walls', { thickness })} />
      <NumberField label="Height" unit={unit} value={wall.height} min={1} onChange={height => update('walls', { height })} />
      <label className="inspector-field"><span>Finish</span>
        <select value={wall.material} onChange={event => update('walls', { material: event.target.value })}>
          {wallMaterials.map(item => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
      <label className="inspector-field"><span>Paint color</span>
        <input type="color" value={wall.color || materialColor[wall.material]}
          onChange={event => update('walls', { color: event.target.value })} />
      </label>
      <button className="inspector-action" type="button" disabled={splitPosition(wall, level.doors, level.windows, level.passages) === null}
        onClick={() => edit(model => ({ ...model, ...splitWall(model.walls, model.doors, model.windows, wall.id, model.passages) }))}>Split wall</button>
    </div>}
    {door && <div className="fields">
      <div className="readout"><span>Host wall</span><b>{door.wallId}</b></div>
      <label className="inspector-field"><span>Door design</span>
        <select aria-label="Door design" value={door.style || 'flush'} onChange={event => update('doors', { style: event.target.value })}>
          <option value="flush">Flush</option><option value="panel">Panel</option><option value="glazed">Glazed</option><option value="double">Double leaf</option>
        </select>
      </label>
      <label className="inspector-field"><span>Hinge side</span>
        <select aria-label="Hinge side" value={door.hinge} onChange={event => update('doors', { hinge: event.target.value })}>
          <option value="left">Left</option><option value="right">Right</option>
        </select>
      </label>
      <label className="inspector-field"><span>Opening</span>
        <select aria-label="Door opening direction" value={door.swing || 'in'} onChange={event => update('doors', { swing: event.target.value })}>
          <option value="in">Into room</option><option value="out">Outward</option>
        </select></label>
      <label className="inspector-field"><span>Door material</span>
        <select aria-label="Door material" value={door.material || 'timber'} onChange={event => update('doors', { material: event.target.value })}>
          <option value="timber">Timber</option><option value="metal">Metal</option>
        </select></label>
      <NumberField label="Offset" unit={unit} value={door.offset} onChange={offset => update('doors', { offset })} />
      <NumberField label="Width" unit={unit} value={door.width} min={.4} onChange={width => update('doors', { width })} />
      <NumberField label="Height" unit={unit} value={door.height} min={1.5} onChange={height => update('doors', { height })} />
      <button className="inspector-action" onClick={() => {
        const next = { ...door, id: uid('door'), offset: door.offset + door.width + .15 }
        const issue = validateOpening(level, next)
        if (issue) setValidation(issue); else edit(model => ({ ...model, doors: [...model.doors, next] }))
      }}>Duplicate door</button>
      <button className="inspector-action" onClick={() => { const id = uid('window'); edit(model => ({ ...model,
        doors: model.doors.filter(item => item.id !== door.id), windows: [...model.windows, { id, wallId: door.wallId,
          offset: door.offset, width: door.width, height: 1.2, sill: .85 }] })); select({ kind: 'window', id }) }}>Convert to window</button>
      <button className="inspector-action" onClick={() => { const id = uid('passage'); edit(model => ({ ...model,
        doors: model.doors.filter(item => item.id !== door.id), passages: [...model.passages, { id, wallId: door.wallId,
          offset: door.offset, width: door.width, height: door.height }] })); select({ kind: 'passage', id }) }}>Convert to open passage</button>
    </div>}
    {windowUnit && <div className="fields">
      <div className="readout"><span>Host wall</span><b>{windowUnit.wallId}</b></div>
      <label className="inspector-field"><span>Frame</span><select aria-label="Window frame" value={windowUnit.frame || 'aluminium'}
        onChange={event => update('windows', { frame: event.target.value })}>
        <option value="aluminium">Aluminium</option><option value="timber">Timber</option>
      </select></label>
      <label className="inspector-field"><span>Window type</span><select aria-label="Window type" value={windowUnit.type || 'sliding'}
        onChange={event => update('windows', { type: event.target.value })}>
        <option value="fixed">Fixed</option><option value="sliding">Sliding</option><option value="casement">Casement</option>
      </select></label>
      <label className="inspector-field"><span>Glazing</span><select aria-label="Window glazing" value={windowUnit.glazing || 'clear'}
        onChange={event => update('windows', { glazing: event.target.value })}>
        <option value="clear">Clear</option><option value="frosted">Frosted</option>
      </select></label>
      <NumberField label="Offset" unit={unit} value={windowUnit.offset} onChange={offset => update('windows', { offset })} />
      <NumberField label="Width" unit={unit} value={windowUnit.width} min={.3} onChange={width => update('windows', { width })} />
      <NumberField label="Height" unit={unit} value={windowUnit.height} min={.3} onChange={height => update('windows', { height })} />
      <NumberField label="Sill" unit={unit} value={windowUnit.sill} onChange={sill => update('windows', { sill })} />
      <button className="inspector-action" onClick={() => { const id = uid('door'); edit(model => ({ ...model,
        windows: model.windows.filter(item => item.id !== windowUnit.id), doors: [...model.doors, { id,
          wallId: windowUnit.wallId, offset: windowUnit.offset, width: windowUnit.width, height: 2.1, hinge: 'left' }] }));
        select({ kind: 'door', id }) }}>Convert to door</button>
    </div>}
    {passage && <div className="fields">
      <div className="readout"><span>Host wall</span><b>{passage.wallId}</b></div>
      <NumberField label="Offset" unit={unit} value={passage.offset} onChange={offset => update('passages', { offset })} />
      <NumberField label="Width" unit={unit} value={passage.width} min={.3} onChange={width => update('passages', { width })} />
      <NumberField label="Height" unit={unit} value={passage.height} min={1.5} onChange={height => update('passages', { height })} />
    </div>}
    {room && <div className="fields">
      <label className="inspector-field"><span>Name</span>
        <input value={room.name} onChange={event => update('rooms', { name: event.target.value })} />
      </label>
      <div className="readout"><span>Area</span><b>{formatArea(roomArea(room), unit)}</b></div>
      <div className="readout"><span>Perimeter</span><b>{formatDistance(roomPerimeter(room), unit)}</b></div>
      <NumberField label="Ceiling" unit={unit} value={room.ceilingHeight || 2.9} min={2}
        onChange={ceilingHeight => update('rooms', { ceilingHeight })} />
      <label className="inspector-field"><span>Floor finish</span>
        <select value={room.material} onChange={event => update('rooms', { material: event.target.value })}>
          {floorMaterials.map(item => <option key={item} value={item}>{item.replace('-', ' ')}</option>)}
        </select>
      </label>
    </div>}
    <button className="delete-button" onClick={remove}>Delete element</button>
    <RoofControls level={level} />
  </aside>
}
