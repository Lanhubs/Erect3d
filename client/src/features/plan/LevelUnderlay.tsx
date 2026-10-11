import type { Level } from '../../domain/types'
import { wallSubpath } from '../../geometry/math'

export function LevelUnderlay({ level }: { level: Level }) {
  return <g pointerEvents="none" opacity=".19">
    {level.rooms.map(room => <polygon key={room.id} points={room.polygon.map(point => `${point.x},${point.z}`).join(' ')} fill="#6d8874" />)}
    {level.walls.map(wall => <polyline key={wall.id} points={wallSubpath(wall).map(point => `${point.x},${point.z}`).join(' ')}
      fill="none" stroke="#375840" strokeWidth={Math.max(.09, wall.thickness)} strokeLinejoin="round" />)}
  </g>
}
