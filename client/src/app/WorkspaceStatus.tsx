import { FiBox } from 'react-icons/fi'
import type {ReactNode} from 'react'
import type { Level, Project } from '../domain/types'

export function WorkspaceStatus({ level, units,extra }: { level: Level; units: Project['units'];extra?:ReactNode }) {
  return <div className={`statusbar${extra?' statusbar-with-tools':''}`}>
    <span title={`${level.name} · ${level.walls.length} walls · ${level.doors.length} doors · ${level.windows.length} windows · ${units.toUpperCase()} · 1:1 MODEL`}><FiBox /> {level.name}</span>
    <span>{level.walls.length} walls · {level.doors.length} doors · {level.windows.length} windows</span>
    <span>{units.toUpperCase()} · 1:1 MODEL</span>
    {extra}
  </div>
}
