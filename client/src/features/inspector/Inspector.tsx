import { SystemsInspector } from './SystemsInspector'
import { EntityTitle } from './EntityTitle'
import { useState } from 'react'
import type { Building, Level, Selection } from '../../domain/types'
import { useProject } from '../../state/project'
import type { Unit } from '../../geometry/units'
import { RoofControls } from './RoofControls'
import { validateOpening } from '../../geometry/openingValidation'
import { StructureInspector } from './StructureInspector'
import { DetailInspector } from './DetailInspector'
import { OpeningInspector } from './OpeningInspector'
import { SiteControls } from './SiteControls'
import { FurnitureInspector } from '../../furniture/FurnitureInspector'
import { SiteInspector } from './SiteInspector'
import { WallInspector } from './WallInspector'
import { RampInspector } from './RampInspector'
import { SeatingInspector } from './SeatingInspector'
import { RoomInspector } from './RoomInspector'

export function Inspector({
  building,
  level,
  selection,
  unit,
  open,
  onClose,
}: {
  building: Building
  level: Level
  selection: Selection
  unit: Unit
  open?: boolean
  onClose?: () => void
}) {
  const [validation, setValidation] = useState('')
  const edit = useProject((s) => s.edit),
    select = useProject((s) => s.setSelection)
  const shell = `inspector${open ? ' mobile-open' : ''}`
  const mobileHead = (
    <div className="inspector-mobile-head">
      <strong>{selection ? `${selection.kind} properties` : 'Properties'}</strong>
      <button type="button" onClick={onClose} aria-label="Close properties">
        ×
      </button>
    </div>
  )
  if (selection?.kind === 'furniture')
    return <FurnitureInspector level={level} selection={selection} open={open} onClose={onClose} />
  if (selection?.kind === 'architecture')
    return (
      <aside className={shell}>
        {mobileHead}
        <SystemsInspector building={building} level={level} selection={selection} />
      </aside>
    )
  if (!selection || selection.kind === 'fence')
    return (
      <SiteInspector building={building} level={level} selection={selection} open={open} onClose={onClose} />
    )
  if (selection.kind === 'slab' || selection.kind === 'column' || selection.kind === 'stair')
    return (
      <StructureInspector
        building={building}
        level={level}
        selection={selection}
        unit={unit}
        open={open}
        onClose={onClose}
      />
    )
  if (selection.kind === 'detail')
    return <DetailInspector level={level} selection={selection} open={open} onClose={onClose} />
  const update = (
    kind: 'walls' | 'doors' | 'windows' | 'passages' | 'rooms',
    change: Record<string, string | number>,
  ) => {
    if (kind === 'doors' || kind === 'windows' || kind === 'passages') {
      const previous = (level[kind] || []).find((item) => item.id === selection.id)
      if (previous) {
        const issue = validateOpening(level, { ...previous, ...change })
        if (issue) {
          setValidation(issue)
          return
        }
      }
    }
    setValidation('')
    edit((model) => ({
      ...model,
      [kind]: model[kind].map((item) => (item.id === selection.id ? { ...item, ...change } : item)),
    }))
  }
  const remove = () => {
    edit((model) => ({
      roof: model.roof,
      walls: model.walls.filter((item) => item.id !== selection.id),
      doors: model.doors.filter((item) => item.id !== selection.id && item.wallId !== selection.id),
      windows: model.windows.filter((item) => item.id !== selection.id && item.wallId !== selection.id),
      passages: model.passages.filter((item) => item.id !== selection.id && item.wallId !== selection.id),
      ramps: model.ramps.filter((item) => item.id !== selection.id),
      seatingSections: model.seatingSections.filter((item) => item.id !== selection.id),
      rooms: model.rooms.filter((item) => item.id !== selection.id),
    }))
    select(null)
  }
  const wall = level.walls.find((item) => item.id === selection.id)
  const ramp = level.ramps?.find((item) => item.id === selection.id)
  const seating = level.seatingSections?.find((item) => item.id === selection.id)
  const door = level.doors.find((item) => item.id === selection.id)
  const windowUnit = level.windows.find((item) => item.id === selection.id)
  const passage = (level.passages || []).find((item) => item.id === selection.id)
  const room = level.rooms.find((item) => item.id === selection.id)
  return (
    <aside className={shell}>
      {mobileHead}
      <SiteControls building={building} />
      <div className="panel-title">PROPERTIES</div>
      <EntityTitle selection={selection} />
      {validation && (
        <div className="inline-error" role="alert">
          {validation}
        </div>
      )}
      {wall && (
        <WallInspector wall={wall} level={level} unit={unit} change={(values) => update('walls', values)} />
      )}
      {ramp && <RampInspector ramp={ramp} unit={unit} />}
      {seating && <SeatingInspector seating={seating} unit={unit} />}
      <OpeningInspector
        level={level}
        door={door}
        windowUnit={windowUnit}
        passage={passage}
        unit={unit}
        update={update}
        setValidation={setValidation}
      />
      {room && <RoomInspector room={room} unit={unit} change={(values) => update('rooms', values)} />}
      <button className="delete-button" onClick={remove}>
        Delete element
      </button>
      <RoofControls level={level} />
    </aside>
  )
}
