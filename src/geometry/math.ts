import type { Calibration, Point, Room, Wall } from '../domain/types'

export const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.z - a.z)
export const wallLength = (wall: Wall) => distance(wall.start, wall.end)
export const atWall = (wall: Wall, offset: number): Point => {
  const t = offset / Math.max(wallLength(wall), .00001)
  return { x: wall.start.x + (wall.end.x - wall.start.x) * t, z: wall.start.z + (wall.end.z - wall.start.z) * t }
}
export const roomArea = (room: Room) => Math.abs(room.polygon.reduce((sum, p, i) => {
  const q = room.polygon[(i + 1) % room.polygon.length]
  return sum + p.x * q.z - q.x * p.z
}, 0)) / 2
export const roomPerimeter = (room: Room) => room.polygon.reduce((sum, p, i) => sum + distance(p, room.polygon[(i + 1) % room.polygon.length]), 0)
export function calibrate(a: Point, b: Point, knownMetres: number): Calibration {
  const pixels = distance(a, b)
  if (pixels < 2 || !Number.isFinite(knownMetres) || knownMetres <= 0) throw new Error('Choose two different points and enter a positive distance.')
  return { a, b, knownMetres, metresPerPixel: knownMetres / pixels }
}
export const sourceToWorld = (point: Point, calibration: Calibration): Point => ({
  x: (point.x - calibration.a.x) * calibration.metresPerPixel,
  z: (point.z - calibration.a.z) * calibration.metresPerPixel,
})
export const worldToSource = (point: Point, calibration: Calibration): Point => ({
  x: point.x / calibration.metresPerPixel + calibration.a.x,
  z: point.z / calibration.metresPerPixel + calibration.a.z,
})
export function nearestPoint(point: Point, walls: Wall[], tolerance: number): Point {
  let best = point
  let gap = tolerance
  for (const wall of walls) for (const end of [wall.start, wall.end]) {
    const d = distance(point, end)
    if (d < gap) { best = end; gap = d }
  }
  return best
}
export function snapWallEnd(start: Point, target: Point, walls: Wall[], tolerance: number): Point {
  const endpoint = nearestPoint(target, walls, tolerance)
  if (endpoint !== target) return endpoint
  for (const wall of walls) {
    const dx = wall.end.x - wall.start.x, dz = wall.end.z - wall.start.z
    const lengthSquared = dx * dx + dz * dz
    if (lengthSquared < .0001) continue
    const t = Math.max(0, Math.min(1, ((target.x - wall.start.x) * dx + (target.z - wall.start.z) * dz) / lengthSquared))
    const projected = { x: wall.start.x + t * dx, z: wall.start.z + t * dz }
    if (distance(target, projected) < tolerance) return projected
  }
  const dx = Math.abs(target.x - start.x), dz = Math.abs(target.z - start.z)
  if (dx <= tolerance && dz > tolerance) return { x: start.x, z: target.z }
  if (dz <= tolerance && dx > tolerance) return { x: target.x, z: start.z }
  return target
}
export function segmentIntersection(a: Point, b: Point, c: Point, d: Point): Point | null {
  const rx = b.x - a.x, rz = b.z - a.z, sx = d.x - c.x, sz = d.z - c.z
  const cross = rx * sz - rz * sx
  if (Math.abs(cross) < 1e-9) return null
  const qx = c.x - a.x, qz = c.z - a.z
  const t = (qx * sz - qz * sx) / cross
  const u = (qx * rz - qz * rx) / cross
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? { x: a.x + t * rx, z: a.z + t * rz } : null
}
