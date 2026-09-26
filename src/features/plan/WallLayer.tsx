import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Point, Selection, Wall } from '../../domain/types'
import { wallLength } from '../../geometry/math'
import { formatDistance, type Unit } from '../../geometry/units'

export type WallDrag = { wallId: string; kind: 'end'; end: 'start' | 'end'; point: Point } | {
  wallId: string; kind: 'wall'; origin: Point; start: Point; end: Point; delta: Point
}
type Props = {
  walls: Wall[]; selection: Selection; drag: WallDrag | null; tool: string; unit: Unit
  onWallDown: (event: ReactPointerEvent<SVGGElement>, wall: Wall) => void
  onEndDown: (event: ReactPointerEvent<SVGCircleElement>, wall: Wall, end: 'start' | 'end') => void
}

function WallDimension({ wall, unit }: { wall: Wall; unit: Unit }) {
  const dx = wall.end.x - wall.start.x, dz = wall.end.z - wall.start.z
  const length = Math.hypot(dx, dz)
  if (length < .1) return null
  const nx = -dz / length * .42, nz = dx / length * .42
  const a = { x: wall.start.x + nx, z: wall.start.z + nz }
  const b = { x: wall.end.x + nx, z: wall.end.z + nz }
  const angle = Math.atan2(dz, dx) * 180 / Math.PI
  const textAngle = angle > 90 || angle < -90 ? angle + 180 : angle
  const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2
  return <g className="wall-dimension" pointerEvents="none">
    <line x1={wall.start.x} y1={wall.start.z} x2={a.x + nx * .25} y2={a.z + nz * .25} />
    <line x1={wall.end.x} y1={wall.end.z} x2={b.x + nx * .25} y2={b.z + nz * .25} />
    <line x1={a.x} y1={a.z} x2={b.x} y2={b.z} />
    {[a, b].map((p, i) => <circle key={i} cx={p.x} cy={p.z} r=".065" />)}
    <text x={mx} y={mz - .1} textAnchor="middle" transform={`rotate(${textAngle} ${mx} ${mz})`}>
      {formatDistance(wallLength(wall), unit)}
    </text>
  </g>
}

export function WallLayer({ walls, selection, drag, tool, unit, onWallDown, onEndDown }: Props) {
  return <>{walls.map(item => {
    const wall = drag?.wallId !== item.id ? item : drag.kind === 'end'
      ? { ...item, [drag.end]: drag.point }
      : { ...item, start: { x: drag.start.x + drag.delta.x, z: drag.start.z + drag.delta.z },
        end: { x: drag.end.x + drag.delta.x, z: drag.end.z + drag.delta.z } }
    const selected = selection?.kind === 'wall' && selection.id === wall.id
    return <g key={wall.id} className="plan-entity" onPointerDown={event => { if (tool === 'select') onWallDown(event, wall) }}>
      <line x1={wall.start.x} y1={wall.start.z} x2={wall.end.x} y2={wall.end.z}
        stroke={selected ? '#b28b4a' : '#36403c'} strokeWidth={wall.thickness} strokeLinecap="square" />
      {selected && <WallDimension wall={wall} unit={unit} />}
      {selected && (['start', 'end'] as const).map(end => <circle key={end}
        cx={wall[end].x} cy={wall[end].z} r=".12" fill="#f7f7f3" stroke="#a67c39" strokeWidth=".04"
        onPointerDown={event => onEndDown(event, wall, end)} />)}
    </g>
  })}</>
}
