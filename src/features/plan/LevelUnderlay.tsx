import type { Level } from '../../domain/types'

export function LevelUnderlay({ level }: { level: Level }) {
  return <g pointerEvents="none" opacity=".19">
    {level.rooms.map(room => <polygon key={room.id} points={room.polygon.map(point => `${point.x},${point.z}`).join(' ')} fill="#6d8874" />)}
    {level.walls.map(wall => <line key={wall.id} x1={wall.start.x} y1={wall.start.z} x2={wall.end.x} y2={wall.end.z}
      stroke="#375840" strokeWidth={Math.max(.09, wall.thickness)} />)}
  </g>
}
