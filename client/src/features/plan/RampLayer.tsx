import type { Ramp, Selection } from '../../domain/types'
import type { Tool } from '../../state/project'

function outline(ramp: Ramp) {
  const dx = ramp.end.x - ramp.start.x,
    dz = ramp.end.z - ramp.start.z
  const length = Math.hypot(dx, dz) || 1,
    x = ((-dz / length) * ramp.width) / 2,
    z = ((dx / length) * ramp.width) / 2
  return [
    { x: ramp.start.x + x, z: ramp.start.z + z },
    { x: ramp.end.x + x, z: ramp.end.z + z },
    { x: ramp.end.x - x, z: ramp.end.z - z },
    { x: ramp.start.x - x, z: ramp.start.z - z },
  ]
}

export function RampLayer({
  ramps,
  selection,
  select,
  tool,
}: {
  ramps: Ramp[]
  selection: Selection
  select: (selection: Selection) => void
  tool: Tool
}) {
  return (
    <g className="ramp-layer">
      {ramps.map((ramp) => {
        const polygon = outline(ramp)
        const selected = selection?.kind === 'ramp' && selection.id === ramp.id
        return (
          <g
            key={ramp.id}
            className="plan-entity"
            onPointerDown={(event) => {
              if (tool === 'select') {
                event.stopPropagation()
                select({ kind: 'ramp', id: ramp.id })
              }
            }}
          >
            <polygon
              points={polygon.map((point) => `${point.x},${point.z}`).join(' ')}
              fill={selected ? '#d5b77f' : '#9a8d76'}
              fillOpacity={0.48}
              stroke={selected ? '#a96f30' : '#71685a'}
              strokeWidth=".05"
            />
            <line
              x1={ramp.start.x}
              y1={ramp.start.z}
              x2={ramp.end.x}
              y2={ramp.end.z}
              stroke="#685945"
              strokeWidth=".035"
              strokeDasharray=".16 .09"
              pointerEvents="none"
            />
          </g>
        )
      })}
    </g>
  )
}
