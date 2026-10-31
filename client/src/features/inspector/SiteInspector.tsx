import type { Building, Level, Selection } from '../../domain/types'
import { SiteControls } from './SiteControls'
import { RoofControls } from './RoofControls'
import { ArchitectureControls } from './ArchitectureControls'
import { SystemsInspector } from './SystemsInspector'

/** The panel shown when nothing editable is selected, or when the site fence is. */
export function SiteInspector({
  building,
  level,
  selection,
  open,
  onClose,
}: {
  building: Building
  level: Level
  selection: Selection
  open?: boolean
  onClose?: () => void
}) {
  return (
    <aside className={`inspector${open ? ' mobile-open' : ''}`}>
      <div className="inspector-mobile-head">
        <strong>{selection ? `${selection.kind} properties` : 'Properties'}</strong>
        <button type="button" onClick={onClose} aria-label="Close properties">
          ×
        </button>
      </div>
      <SiteControls building={building} />
      <div className="panel-title">PROPERTIES</div>
      <div className="inspector-empty">Select a wall, opening, or room to edit its properties.</div>
      <div className="panel-title">LEVEL SUMMARY</div>
      <div className="summary-grid">
        <span>Walls</span>
        <b>{level.walls.length}</b>
        <span>Doors</span>
        <b>{level.doors.length}</b>
        <span>Windows</span>
        <b>{level.windows.length}</b>
        <span>Rooms</span>
        <b>{level.rooms.length}</b>
      </div>
      <RoofControls level={level} />
      <ArchitectureControls building={building} level={level} />
      <SystemsInspector building={building} level={level} selection={selection} />
    </aside>
  )
}
