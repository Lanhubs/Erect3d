import { FiBox } from 'react-icons/fi'
import type { Level, Project } from '../domain/types'

export function WorkspaceStatus({ level, units }: { level: Level; units: Project['units'] }) {
  return <div className="statusbar">
    <span><FiBox /> {level.name}</span>
    <span>{level.walls.length} walls · {level.doors.length} doors · {level.windows.length} windows</span>
    <span>{units.toUpperCase()} · 1:1 MODEL</span>
  </div>
}
