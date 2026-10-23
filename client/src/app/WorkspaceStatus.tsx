import { FiBox } from 'react-icons/fi'
import type { ReactNode } from 'react'
import type { Level, Project } from '../domain/types'

export function WorkspaceStatus({
  level,
  units,
  extra,
  attention,
  onLevels,
}: {
  level: Level
  units: Project['units']
  extra?: ReactNode
  attention?: ReactNode
  onLevels?: () => void
}) {
  return (
    <div className={`statusbar${extra ? ' statusbar-with-tools' : ''}`}>
      <span
        title={`${level.name} · ${level.walls.length} walls · ${level.doors.length} doors · ${level.windows.length} windows · ${units.toUpperCase()} · 1:1 MODEL`}
      >
        <button className="level-status" onClick={onLevels}>
          <FiBox /> {level.name}
        </button>
      </span>
      <span>
        {level.walls.length} walls · {level.doors.length} doors · {level.windows.length} windows
      </span>
      <span>{units.toUpperCase()} · 1:1 MODEL</span>
      {attention}
      {extra}
    </div>
  )
}
