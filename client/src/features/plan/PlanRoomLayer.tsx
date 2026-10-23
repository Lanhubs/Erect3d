import type { Room, Selection } from '../../domain/types'
import { roomArea } from '../../geometry/math'
import { formatArea, type Unit } from '../../geometry/units'
import { SportsPlanDetails } from './SportsPlanDetails'

export function PlanRoomLayer({
  rooms,
  selection,
  select,
  tool,
  unit,
}: {
  rooms: Room[]
  selection: Selection
  select: (selection: Selection) => void
  tool: string
  unit: Unit
}) {
  return (
    <>
      {rooms.map((room) => (
        <g
          key={room.id}
          className="plan-entity"
          onPointerDown={(event) => {
            if (tool === 'select') {
              event.stopPropagation()
              select({ kind: 'room', id: room.id })
            }
          }}
        >
          <polygon
            points={room.polygon.map((point) => `${point.x},${point.z}`).join(' ')}
            fill={
              selection?.id === room.id
                ? '#c5ba98'
                : room.category === 'football-pitch'
                  ? '#579050'
                  : room.category === 'table-tennis-hall'
                    ? '#83a398'
                    : '#e2dfd4'
            }
            fillOpacity={
              room.category === 'football-pitch' || room.category === 'table-tennis-hall' ? 0.92 : 0.65
            }
            stroke="#bdc1bb"
            strokeWidth=".02"
          />
          <SportsPlanDetails room={room} />
          <text
            x={room.polygon.reduce((sum, point) => sum + point.x, 0) / room.polygon.length}
            y={
              room.category === 'football-pitch' || room.category === 'table-tennis-hall'
                ? Math.min(...room.polygon.map((point) => point.z)) + 3
                : room.polygon.reduce((sum, point) => sum + point.z, 0) / room.polygon.length
            }
            textAnchor="middle"
            className="room-label"
          >
            {room.name} · {formatArea(roomArea(room), unit)}
          </text>
        </g>
      ))}
    </>
  )
}
