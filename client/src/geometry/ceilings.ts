import type { Level, Point, Room } from '../domain/types'
import { enclosedSpaces } from './roomTopology'
import { wallSubpath } from './math'

export const uncoveredSpace = (room: Pick<Room, 'name' | 'category'>) =>
  /open.to.below|courtyard|atrium|pool|football|basketball|table.tennis/.test(
    `${room.name} ${room.category || ''}`.toLowerCase(),
  ) ||
  (!/\b(?:covered|cov.?d|screened|enclosed)\b/i.test(room.name) &&
    /balcon|terrace|\bdeck\b|patio|porch|lanai|garden|driveway|parking/i.test(room.name))

function distance(point: Point, a: Point, b: Point) {
  const dx = b.x - a.x,
    dz = b.z - a.z
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / (dx * dx + dz * dz || 1)))
  return Math.hypot(point.x - a.x - t * dx, point.z - a.z - t * dz)
}

export function ceilingHeight(level: Level, room: Room, next?: Level) {
  if (room.ceilingHeight !== undefined) return room.ceilingHeight
  const hosts = level.walls.filter((wall) =>
    wallSubpath(wall).some((point) =>
      room.polygon.some(
        (a, i) => distance(point, a, room.polygon[(i + 1) % room.polygon.length]) <= wall.thickness + 0.12,
      ),
    ),
  )
  const heights = (hosts.length ? hosts : level.walls)
    .map((wall) => wall.height)
    .filter((h) => h > 0)
    .sort((a, b) => a - b)
  const wallTop = heights[Math.floor(heights.length / 2)] ?? level.floorToFloorHeight ?? 2.8
  const upper = next ? next.elevation - level.elevation - (next.slabThickness || 0.2) : Infinity
  return Math.max(0.1, Math.min(wallTop, upper))
}

export function ceilingPlan(level: Level, levels: Level[]) {
  const next = levels
    .filter((item) => item.elevation > level.elevation + 0.01)
    .sort((a, b) => a.elevation - b.elevation)[0]
  const openings = [
    ...(next?.slabs?.flatMap((slab) => slab.openings.map((opening) => opening.polygon)) || []),
    ...(level.slabs?.flatMap((slab) =>
      slab.openings.filter((opening) => opening.kind !== 'stair').map((opening) => opening.polygon),
    ) || []),
    ...level.rooms.filter(uncoveredSpace).map((room) => room.polygon),
  ]
  const rooms: Room[] = level.rooms.length
    ? level.rooms
    : level.autoSlab === false
      ? []
      : enclosedSpaces(level.walls).map((polygon, index) => ({
          id: `ceiling:${level.id}:${index}`,
          name: 'Interior',
          material: 'concrete',
          polygon,
        }))
  return rooms
    .filter((room) => !uncoveredSpace(room))
    .map((room) => ({ room, openings, height: ceilingHeight(level, room, next) }))
}
