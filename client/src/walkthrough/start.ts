import type { Level, Point } from '../domain/types'
import { containsPoint } from '../geometry/polygons'
import { walkStart } from '../geometry/walk'
import { blockedAt } from './collision'
import { floorAt, headBlocked } from './grounding'
import type { WalkWorld } from './movement'
import type { WalkOptions, WalkViewpoint } from './types'
export function safeWalkStart(level: Level, world: WalkWorld, options: WalkOptions, camera: Point, viewpoints: WalkViewpoint[] = []) {
  const saved = viewpoints.find(item => item.id === options.start), entrance = walkStart(level)
  const room = level.rooms.find(room => room.id === options.roomId) || level.rooms[0]
  const center = room && { x: room.polygon.reduce((s, p) => s + p.x, 0) / room.polygon.length, z: room.polygon.reduce((s, p) => s + p.z, 0) / room.polygon.length }
  const point = saved?.point || (options.start === 'camera' ? camera : options.start === 'room' && center ? center : entrance.point)
  const foot = saved?.foot ?? level.elevation
  const valid = (p: Point) => !blockedAt(world.obstacles, p.x, p.z, foot) && !headBlocked(world, p.x, p.z, foot)
    && floorAt(world, p.x, p.z, foot) >= foot - .1
    && (options.start !== 'room' || !room || containsPoint(room.polygon, p))
  if (valid(point)) return { point, foot, yaw: saved?.yaw ?? entrance.yaw, pitch: saved?.pitch || 0 }
  for (let r = .3; r <= 6; r += .3) for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
    const p = { x: point.x + Math.cos(a) * r, z: point.z + Math.sin(a) * r }
    if (valid(p)) return { point: p, foot, yaw: saved?.yaw ?? entrance.yaw, pitch: saved?.pitch || 0 }
  }
  return { point: entrance.point, foot: level.elevation, yaw: entrance.yaw, pitch: 0 }
}
