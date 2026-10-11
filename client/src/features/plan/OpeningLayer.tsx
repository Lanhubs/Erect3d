import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import type { Level, Selection, Wall } from '../../domain/types'
import { nearestWallOffset, wallLength, wallSubpath } from '../../geometry/math'
import { validateOpening } from '../../geometry/openingValidation'
import { useProject, type Tool } from '../../state/project'

type Drag = { kind: 'doors' | 'windows' | 'passages'; id: string; wall: Wall; width: number; original: number }
type Props = { svg: RefObject<SVGSVGElement | null>; level: Level; selection: Selection;
  select: (selection: Selection) => void; tool: Tool }

export function OpeningLayer({ svg, level, selection, select, tool }: Props) {
  const edit = useProject(state => state.edit)
  const dragging = useRef<Drag | null>(null)
  const offsetRef = useRef<number | null>(null)
  const [preview, setPreview] = useState<{ id: string; offset: number } | null>(null)
  const project = useCallback((wall: Wall, clientX: number, clientY: number) => {
    const node = svg.current!, local = node.createSVGPoint()
    local.x = clientX; local.y = clientY
    const p = local.matrixTransform(node.getScreenCTM()!.inverse())
    return nearestWallOffset(wall, { x: p.x, z: p.y }).offset
  }, [svg])
  useEffect(() => {
    const move = (event: PointerEvent) => {
      const drag = dragging.current
      if (!drag) return
      const opening = (level[drag.kind] || []).find(item => item.id === drag.id)
      if (!opening) return
      const offset = Math.max(.05, Math.min(wallLength(drag.wall) - drag.width - .05,
        project(drag.wall, event.clientX, event.clientY) - drag.width / 2))
      if (validateOpening(level, { ...opening, offset })) return
      offsetRef.current = offset; setPreview({ id: drag.id, offset })
    }
    const up = () => {
      const drag = dragging.current, offset = offsetRef.current
      if (drag && offset !== null && Math.abs(offset - drag.original) > .01)
        edit(model => ({ ...model, [drag.kind]: model[drag.kind].map(item => item.id === drag.id ? { ...item, offset } : item) }))
      dragging.current = null; offsetRef.current = null; setPreview(null)
    }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  }, [edit, level, project])
  const begin = (event: ReactPointerEvent, kind: Drag['kind'], id: string, wall: Wall, width: number, offset: number) => {
    event.stopPropagation(); select({ kind: kind === 'doors' ? 'door' : kind === 'windows' ? 'window' : 'passage', id })
    if (tool !== 'select') return
    dragging.current = { kind, id, wall, width, original: offset }
    svg.current?.setPointerCapture(event.pointerId)
  }
  return <g className="opening-layer">
    {level.doors.map(door => { const wall = level.walls.find(item => item.id === door.wallId); if (!wall) return null
      const offset = preview?.id === door.id ? preview.offset : door.offset
      const points = wallSubpath(wall, offset, offset + door.width).map(point => `${point.x},${point.z}`).join(' ')
      const chosen = selection?.id === door.id
      return <g key={door.id} className="plan-entity plan-door" onPointerDown={event => begin(event, 'doors', door.id, wall, door.width, offset)}>
        <polyline points={points} fill="none" stroke="transparent" strokeWidth={Math.max(.38, wall.thickness * 2.2)} />
        <polyline points={points} fill="none" stroke={chosen ? '#d89237' : '#f4f5f2'} strokeWidth={wall.thickness * 1.25} pointerEvents="none" />
        {chosen && <polyline points={points} fill="none" stroke="#5f431d" strokeWidth=".055" pointerEvents="none" />}
      </g>
    })}
    {level.windows.map(item => { const wall = level.walls.find(w => w.id === item.wallId); if (!wall) return null
      const offset = preview?.id === item.id ? preview.offset : item.offset
      const points = wallSubpath(wall, offset, offset + item.width).map(point => `${point.x},${point.z}`).join(' ')
      return <polyline key={item.id} className="plan-entity" points={points} fill="none"
        stroke={selection?.id === item.id ? '#b28b4a' : '#7ba3ad'} strokeWidth={Math.max(.16, wall.thickness * .75)}
        onPointerDown={event => begin(event, 'windows', item.id, wall, item.width, offset)} />
    })}
    {(level.passages || []).map(item => { const wall = level.walls.find(w => w.id === item.wallId); if (!wall) return null
      const offset = preview?.id === item.id ? preview.offset : item.offset
      const points = wallSubpath(wall, offset, offset + item.width).map(point => `${point.x},${point.z}`).join(' ')
      return <polyline key={item.id} className="plan-entity" points={points} fill="none"
        stroke={selection?.id === item.id ? '#b28b4a' : '#8a9688'} strokeWidth={Math.max(.18, wall.thickness)} strokeDasharray=".12 .07"
        onPointerDown={event => begin(event, 'passages', item.id, wall, item.width, offset)} />
    })}
  </g>
}
