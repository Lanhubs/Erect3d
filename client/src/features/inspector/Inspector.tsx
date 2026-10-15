import {SystemsInspector} from './SystemsInspector'
import { useState } from 'react'
import type { Building, Level, Selection, WallCurve } from '../../domain/types'
import { roomArea, roomPerimeter, wallLength } from '../../geometry/math'
import { resizeWall, rotateWall, splitPosition, splitWall, wallAngle } from '../../geometry/editWall'
import { useProject } from '../../state/project'
import { materialColor } from '../../rendering/materials'
import { formatArea, formatDistance, type Unit } from '../../geometry/units'
import { RoofControls } from './RoofControls'
import { validateOpening } from '../../geometry/openingValidation'
import { StructureInspector } from './StructureInspector'
import { DetailInspector } from './DetailInspector'
import { OpeningInspector } from './OpeningInspector'
import { SiteControls } from './SiteControls'
import { wallWithCurve } from '../../geometry/math'
import { FurnitureInspector } from '../../furniture/FurnitureInspector'
import { NumberField } from './NumberField'
import {ArchitectureControls} from './ArchitectureControls'

const materials = Object.keys(materialColor)
const wallMaterials = materials.filter(item => !['marble', 'carpet', 'polished-concrete'].includes(item))
const floorMaterials = ['tile', 'porcelain-tile', 'oak', 'timber', 'laminate', 'marble', 'carpet', 'polished-concrete', 'concrete']
export function Inspector({ building, level, selection, unit, open, onClose }: { building: Building; level: Level; selection: Selection; unit: Unit; open?: boolean; onClose?: () => void }) {
  const [validation, setValidation] = useState('')
  const edit = useProject(s => s.edit), select = useProject(s => s.setSelection)
  const shell = `inspector${open ? ' mobile-open' : ''}`
  const mobileHead = <div className="inspector-mobile-head"><strong>{selection ? `${selection.kind} properties` : 'Properties'}</strong><button type="button" onClick={onClose} aria-label="Close properties">×</button></div>
  if (selection?.kind === 'furniture') return <FurnitureInspector level={level} selection={selection} open={open} onClose={onClose} />
  if(selection?.kind==='architecture')return <aside className={shell}>{mobileHead}<SystemsInspector building={building} level={level} selection={selection}/></aside>
  if (!selection || selection.kind === 'fence') return <aside className={shell}>
    {mobileHead}
    <SiteControls building={building} />
    <div className="panel-title">PROPERTIES</div>
    <div className="inspector-empty">Select a wall, opening, or room to edit its properties.</div>
    <div className="panel-title">LEVEL SUMMARY</div>
    <div className="summary-grid"><span>Walls</span><b>{level.walls.length}</b>
      <span>Doors</span><b>{level.doors.length}</b>
      <span>Windows</span><b>{level.windows.length}</b>
      <span>Rooms</span><b>{level.rooms.length}</b></div>
    <RoofControls level={level} />
    <ArchitectureControls building={building} level={level}/>
    <SystemsInspector building={building} level={level} selection={selection}/>
  </aside>
  if (selection.kind === 'slab' || selection.kind === 'column' || selection.kind === 'stair')
    return <StructureInspector building={building} level={level} selection={selection} unit={unit} open={open} onClose={onClose} />
  if (selection.kind === 'detail')
    return <DetailInspector level={level} selection={selection} open={open} onClose={onClose} />
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
      ramps: model.ramps.filter(item => item.id !== selection.id),
      seatingSections: model.seatingSections.filter(item => item.id !== selection.id),
      rooms: model.rooms.filter(item => item.id !== selection.id),
    }))
    select(null)
  }
  const wall = level.walls.find(item => item.id === selection.id)
  const ramp = level.ramps?.find(item => item.id === selection.id)
  const seating = level.seatingSections?.find(item => item.id === selection.id)
  const updateCurve = (change: Partial<WallCurve>) => {
    if (!wall?.curve) return
    const curve = { ...wall.curve, ...change }
    edit(model => ({ ...model, walls: model.walls.map(item => item.id === wall.id ? wallWithCurve(item, curve) : item) }))
  }
  const door = level.doors.find(item => item.id === selection.id)
  const windowUnit = level.windows.find(item => item.id === selection.id)
  const passage = (level.passages || []).find(item => item.id === selection.id)
  const room = level.rooms.find(item => item.id === selection.id)
  const minimumWallLength = wall ? Math.max(.1, ...[...level.doors, ...level.windows, ...(level.passages || [])]
    .filter(item => item.wallId === wall.id).map(item => item.offset + item.width + .05)) : .1
  return <aside className={shell}>
    {mobileHead}
    <SiteControls building={building} />
    <div className="panel-title">PROPERTIES</div>
    <div className="entity-title"><strong>{selection.kind.toUpperCase()}</strong><small>{selection.id}</small></div>
    {validation && <div className="inline-error" role="alert">{validation}</div>}
    {wall && <div className="fields">
      {wall.curve ? <>
        <NumberField label="Curve radius" unit={unit} value={wall.curve.radius} min={.1} onChange={radius => updateCurve({ radius: Math.max(.1, radius) })} />
        <NumberField label="Center X" unit={unit} value={wall.curve.center.x}
          onChange={x => updateCurve({ center: { ...wall.curve!.center, x } })} />
        <NumberField label="Center Z" unit={unit} value={wall.curve.center.z}
          onChange={z => updateCurve({ center: { ...wall.curve!.center, z } })} />
        <label className="inspector-field"><span>Start angle · °</span><input aria-label="Curve start angle" type="number" step="1"
          value={Number((wall.curve.startAngle * 180 / Math.PI).toFixed(1))}
          onChange={event => updateCurve({ startAngle: Number(event.target.value) * Math.PI / 180 })} /></label>
        <label className="inspector-field"><span>End angle · °</span><input aria-label="Curve end angle" type="number" step="1"
          value={Number((wall.curve.endAngle * 180 / Math.PI).toFixed(1))}
          onChange={event => updateCurve({ endAngle: Number(event.target.value) * Math.PI / 180 })} /></label>
      </> : <>
        <NumberField label="Length" unit={unit} value={wallLength(wall)} min={minimumWallLength}
          onChange={length => edit(model => ({ ...model, walls: model.walls.map(item => item.id === wall.id
            ? resizeWall(item, Math.max(minimumWallLength, length)) : item) }))} />
        <label className="inspector-field"><span>Angle · °</span><input aria-label="Wall angle" type="number" step="1"
          value={Number(wallAngle(wall).toFixed(1))} onChange={event => edit(model => ({ ...model,
            walls: model.walls.map(item => item.id === wall.id ? rotateWall(item, Number(event.target.value)) : item) }))} /></label>
      </>}
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
    {ramp && <div className="fields">
      <div className="readout"><span>Run</span><b>{formatDistance(Math.hypot(ramp.end.x - ramp.start.x, ramp.end.z - ramp.start.z), unit)}</b></div>
      <div className="readout"><span>Slope</span><b>{(Math.atan2(ramp.endElevation - ramp.startElevation,
        Math.hypot(ramp.end.x - ramp.start.x, ramp.end.z - ramp.start.z)) * 100).toFixed(1)}%</b></div>
      {(['start','end'] as const).flatMap(pointName => (['x','z'] as const).map(axis => <NumberField key={`${pointName}:${axis}`}
        label={`${pointName} ${axis.toUpperCase()}`} unit={unit} value={ramp[pointName][axis]}
        onChange={value => edit(model => ({ ...model, ramps: model.ramps.map(item => item.id === ramp.id
          ? { ...item, [pointName]: { ...item[pointName], [axis]: value } } : item) }))} />))}
      <NumberField label="Width" unit={unit} value={ramp.width} min={.4}
        onChange={width => edit(model => ({ ...model, ramps: model.ramps.map(item => item.id === ramp.id ? { ...item, width: Math.max(.4, width) } : item) }))} />
      <NumberField label="Thickness" unit={unit} value={ramp.thickness} min={.05}
        onChange={thickness => edit(model => ({ ...model, ramps: model.ramps.map(item => item.id === ramp.id ? { ...item, thickness: Math.max(.05, thickness) } : item) }))} />
      <NumberField label="Start elevation" unit={unit} value={ramp.startElevation}
        onChange={startElevation => edit(model => ({ ...model, ramps: model.ramps.map(item => item.id === ramp.id ? { ...item, startElevation } : item) }))} />
      <NumberField label="End elevation" unit={unit} value={ramp.endElevation}
        onChange={endElevation => edit(model => ({ ...model, ramps: model.ramps.map(item => item.id === ramp.id ? { ...item, endElevation } : item) }))} />
      <label className="inspector-field"><span>Material</span><select value={ramp.material} onChange={event => edit(model => ({ ...model,
        ramps: model.ramps.map(item => item.id === ramp.id ? { ...item, material: event.target.value as typeof item.material } : item) }))}>
        <option value="reinforced-concrete">Reinforced concrete</option><option value="concrete">Concrete</option>
        <option value="timber">Timber</option><option value="steel-deck">Steel deck</option>
      </select></label>
    </div>}
    {seating && <div className="fields">
      <label className="inspector-field"><span>Section name</span><input value={seating.name}
        onChange={event => edit(model => ({ ...model, seatingSections: model.seatingSections.map(item => item.id === seating.id
          ? { ...item, name: event.target.value } : item) }))} /></label>
      {(['start','end','outward'] as const).flatMap(pointName => (['x','z'] as const).map(axis => <NumberField key={`${pointName}:${axis}`}
        label={`${pointName} ${axis.toUpperCase()}`} unit={unit} value={seating[pointName][axis]}
        onChange={value => edit(model => ({ ...model, seatingSections: model.seatingSections.map(item => item.id === seating.id
          ? { ...item, [pointName]: { ...item[pointName], [axis]: value } } : item) }))} />))}
      {(['rows','seatsPerRow'] as const).map(field => <label key={field} className="inspector-field">
        <span>{field === 'rows' ? 'Rows' : 'Seats / row'}</span><input aria-label={field === 'rows' ? 'Seating rows' : 'Seats per row'}
          type="number" min="1" step="1" value={seating[field]} onChange={event => edit(model => ({ ...model,
            seatingSections: model.seatingSections.map(item => item.id === seating.id
              ? { ...item, [field]: Math.max(1, Math.round(Number(event.target.value))) } : item) }))} /></label>)}
      {(['rowDepth','rowRise'] as const).map(field => <NumberField key={field} label={field === 'rowDepth' ? 'Row depth' : 'Rise per row'}
        unit={unit} value={seating[field]} min={.05} onChange={value => edit(model => ({ ...model,
          seatingSections: model.seatingSections.map(item => item.id === seating.id ? { ...item, [field]: Math.max(.05, value) } : item) }))} />)}
      <NumberField label="Fan width growth / row" unit={unit} value={seating.rowWidthGrowth || 0} min={0}
        onChange={value=>edit(model=>({...model,seatingSections:model.seatingSections.map(item=>item.id===seating.id?{...item,rowWidthGrowth:Math.max(0,Math.min(5,value))}:item)}))}/>
      <label className="inspector-field"><span>Base elevation · m</span><input type="number" step="0.1" value={seating.baseElevation}
        onChange={event => edit(model => ({ ...model, seatingSections: model.seatingSections.map(item => item.id === seating.id
          ? { ...item, baseElevation: Number(event.target.value) } : item) }))} /></label>
      <label className="inspector-field"><span>Seat color</span><input type="color" value={seating.seatColor}
        onChange={event => edit(model => ({ ...model, seatingSections: model.seatingSections.map(item => item.id === seating.id
          ? { ...item, seatColor: event.target.value } : item) }))} /></label>
    </div>}
    <OpeningInspector level={level} door={door} windowUnit={windowUnit} passage={passage} unit={unit}
      update={update} setValidation={setValidation} />
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
