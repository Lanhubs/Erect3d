import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import type { Point, Wall } from '../../domain/types'
import type { OpeningCandidate } from '../../geometry/openingCandidates'

export type ReviewView = { source: boolean; walls: boolean; openings: boolean; opacity: number }
type Props = { svg: RefObject<SVGSVGElement | null>; candidates: Wall[]; setCandidates: (change: (walls: Wall[]) => Wall[]) => void;
  openings: OpeningCandidate[]; view: ReviewView; selected: string | null; setSelected: (id: string | null) => void }
type Drag = { id: string; part: 'move' | 'start' | 'end'; anchor: Point; wall: Wall }

export function ReviewLayer({ svg, candidates, setCandidates, openings, view, selected, setSelected }: Props) {
  const dragging = useRef<Drag | null>(null)
  const pending = useRef<Wall | null>(null)
  const [preview, setPreview] = useState<Wall | null>(null)
  const point = useCallback((clientX: number, clientY: number): Point => {
    const node = svg.current!, local = node.createSVGPoint()
    local.x = clientX; local.y = clientY
    const mapped = local.matrixTransform(node.getScreenCTM()!.inverse())
    return { x: mapped.x, z: mapped.y }
  }, [svg])
  useEffect(() => {
    const move = (event: PointerEvent) => {
      const drag = dragging.current
      if (!drag) return
      const current = point(event.clientX, event.clientY)
      const delta = { x: current.x - drag.anchor.x, z: current.z - drag.anchor.z }
      const updated = drag.part === 'move' ? { ...drag.wall,
        start: { x: drag.wall.start.x + delta.x, z: drag.wall.start.z + delta.z },
        end: { x: drag.wall.end.x + delta.x, z: drag.wall.end.z + delta.z } }
        : { ...drag.wall, [drag.part]: current }
      pending.current = updated; setPreview(updated)
    }
    const up = () => {
      const drag = dragging.current
      if (drag && pending.current) setCandidates(items => items.map(item => item.id === drag.id ? pending.current! : item))
      dragging.current = null; pending.current = null; setPreview(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  }, [point, setCandidates, svg])
  const start = (event: ReactPointerEvent, wall: Wall, part: Drag['part']) => {
    event.stopPropagation(); setSelected(wall.id)
    dragging.current = { id: wall.id, part, anchor: point(event.clientX, event.clientY), wall }
    svg.current?.setPointerCapture(event.pointerId)
  }
  return <g className="review-layer">
    {view.walls && candidates.map(original => {
      const wall = preview?.id === original.id ? preview : original
      return <g key={wall.id}>
        <line x1={wall.start.x} y1={wall.start.z} x2={wall.end.x} y2={wall.end.z}
          stroke={selected === wall.id ? '#b05c25' : '#b87845'} strokeWidth={Math.max(.09, wall.thickness)} strokeDasharray=".15 .09"
          onPointerDown={event => start(event, wall, 'move')} />
        {selected === wall.id && [wall.start, wall.end].map((p, index) => <circle key={index}
          cx={p.x} cy={p.z} r=".14" fill="#fff" stroke="#a65e28" strokeWidth=".05"
          onPointerDown={event => start(event, wall, index ? 'end' : 'start')} />)}
      </g>
    })}
    {view.openings && openings.map(item => <g key={item.id} pointerEvents="none">
      <line x1={item.start.x} y1={item.start.z} x2={item.end.x} y2={item.end.z}
        stroke={item.choice === 'unknown' ? '#bb7c30' : item.choice === 'window' ? '#417b92' : item.choice === 'door' ? '#57905c' : '#8d6f57'}
        strokeWidth=".11" strokeDasharray=".11 .08" />
      <circle cx={(item.start.x + item.end.x) / 2} cy={(item.start.z + item.end.z) / 2} r=".11" fill="#fff" stroke="#8d6f57" strokeWidth=".04" />
    </g>)}
  </g>
}
