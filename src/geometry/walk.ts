import type { Level, Point } from '../domain/types'
import { atWall, wallLength } from './math'
import { collides } from './walls'

export function walkStart(level: Level): { point: Point; yaw: number } {
  const ends = level.walls.flatMap(wall => [wall.start, wall.end])
  if (!ends.length) return { point: { x: 0, z: 0 }, yaw: 0 }
  const center = {
    x: ends.reduce((sum, point) => sum + point.x, 0) / ends.length,
    z: ends.reduce((sum, point) => sum + point.z, 0) / ends.length,
  }
  for (const door of level.doors) {
    const wall = level.walls.find(item => item.id === door.wallId)
    if (!wall) continue
    const midpoint = atWall(wall, Math.min(wallLength(wall), door.offset + door.width / 2))
    const dx = midpoint.x - center.x, dz = midpoint.z - center.z
    const length = Math.hypot(dx, dz) || 1
    const point = { x: midpoint.x + dx / length, z: midpoint.z + dz / length }
    if (collides(point, .22, level.walls, level.doors, level.windows, level.passages)) continue
    return { point, yaw: Math.atan2(point.x - center.x, point.z - center.z) }
  }
  if (!collides(center, .22, level.walls, level.doors, level.windows, level.passages)) return { point: center, yaw: 0 }
  for (let radius = .5; radius < 8; radius += .5) for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
    const point = { x: center.x + Math.cos(angle) * radius, z: center.z + Math.sin(angle) * radius }
    if (!collides(point, .22, level.walls, level.doors, level.windows, level.passages)) return { point, yaw: 0 }
  }
  return { point: center, yaw: 0 }
}

export function nearbyDoor(level: Level, point: Point, reach = 1.55) {
  let best: { id: string; distance: number } | null = null
  for (const door of level.doors) {
    const wall = level.walls.find(item => item.id === door.wallId)
    if (!wall) continue
    const center = atWall(wall, door.offset + door.width / 2)
    const distance = Math.hypot(point.x - center.x, point.z - center.z)
    if (distance < reach && (!best || distance < best.distance)) best = { id: door.id, distance }
  }
  return best?.id || null
}
