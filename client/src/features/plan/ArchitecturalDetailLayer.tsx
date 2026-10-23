import type { ArchitecturalDetail, Selection } from '../../domain/types'
import type { Tool } from '../../state/project'

export function ArchitecturalDetailLayer({
  details,
  selection,
  select,
  tool,
}: {
  details: ArchitecturalDetail[]
  selection: Selection
  select: (selection: Selection) => void
  tool: Tool
}) {
  return (
    <g pointerEvents={tool === 'select' ? 'auto' : 'none'}>
      {details.map((detail) => {
        const dx = detail.end.x - detail.start.x,
          dz = detail.end.z - detail.start.z
        const length = Math.hypot(dx, dz) || 1,
          normal = { x: -dz / length, z: dx / length }
        const selected = selection?.kind === 'detail' && selection.id === detail.id
        const color = selected ? '#b27a37' : detail.kind === 'railing' ? '#637b81' : '#8c7460'
        return (
          <g
            key={detail.id}
            className="plan-entity"
            onPointerDown={(event) => {
              event.stopPropagation()
              select({ kind: 'detail', id: detail.id })
            }}
          >
            {detail.kind === 'canopy' || detail.kind === 'pergola' ? (
              <polygon
                points={[
                  detail.start,
                  detail.end,
                  { x: detail.end.x + normal.x * detail.depth, z: detail.end.z + normal.z * detail.depth },
                  {
                    x: detail.start.x + normal.x * detail.depth,
                    z: detail.start.z + normal.z * detail.depth,
                  },
                ]
                  .map((point) => `${point.x},${point.z}`)
                  .join(' ')}
                fill={color}
                fillOpacity=".16"
                stroke={color}
                strokeWidth=".06"
                strokeDasharray=".18 .1"
              />
            ) : (
              <line
                x1={detail.start.x}
                y1={detail.start.z}
                x2={detail.end.x}
                y2={detail.end.z}
                stroke={color}
                strokeWidth={detail.kind === 'parapet' ? Math.max(0.12, detail.depth) : 0.1}
                strokeDasharray={detail.kind === 'screen' || detail.kind === 'fin' ? '.18 .12' : undefined}
              />
            )}
          </g>
        )
      })}
    </g>
  )
}
