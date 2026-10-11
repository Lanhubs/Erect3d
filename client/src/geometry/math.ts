import type { Calibration, Point, Room, Wall, WallCurve } from '../domain/types'

export const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.z - a.z)
export const wallLength = (wall: Wall) => wall.curve
  ? wall.curve.radius * Math.abs(wall.curve.endAngle - wall.curve.startAngle)
  : distance(wall.start, wall.end)
export const atWall = (wall: Wall, offset: number): Point => {
  const length = wallLength(wall)
  const t = Math.max(0, Math.min(1, offset / Math.max(length, .00001)))
  if (wall.curve) {
    const angle = wall.curve.startAngle + (wall.curve.endAngle - wall.curve.startAngle) * t
    return { x: wall.curve.center.x + Math.cos(angle) * wall.curve.radius,
      z: wall.curve.center.z + Math.sin(angle) * wall.curve.radius }
  }
  return { x: wall.start.x + (wall.end.x - wall.start.x) * t, z: wall.start.z + (wall.end.z - wall.start.z) * t }
}
export const wallTangentAngle = (wall: Wall, offset: number) => {
  if (!wall.curve) return Math.atan2(wall.end.z - wall.start.z, wall.end.x - wall.start.x)
  const length = wallLength(wall), t = Math.max(0, Math.min(1, offset / Math.max(length, .00001)))
  const angle = wall.curve.startAngle + (wall.curve.endAngle - wall.curve.startAngle) * t
  const direction = Math.sign(wall.curve.endAngle - wall.curve.startAngle) || 1
  return Math.atan2(Math.cos(angle) * direction, -Math.sin(angle) * direction)
}
export function wallSubpath(wall: Wall, startOffset = 0, endOffset = wallLength(wall), maxSegmentLength = .35): Point[] {
  const length = wallLength(wall)
  const start = Math.max(0, Math.min(length, startOffset)), end = Math.max(start, Math.min(length, endOffset))
  if (!wall.curve) return [atWall(wall, start), atWall(wall, end)]
  const count = Math.min(256, Math.max(1, Math.ceil((end - start) / Math.max(.05, maxSegmentLength))))
  return Array.from({ length: count + 1 }, (_, index) => atWall(wall, start + (end - start) * index / count))
}
export const wallPoints = (wall: Wall, maxSegmentLength = .35) => wallSubpath(wall, 0, wallLength(wall), maxSegmentLength)
export function wallBoundsPoints(walls: Wall[], maxSegmentLength = .2) {
  return walls.flatMap(wall => {
    const points = wallPoints(wall, maxSegmentLength)
    if (!wall.curve) return points
    const { center, radius, startAngle, endAngle } = wall.curve
    const direction = Math.sign(endAngle - startAngle) || 1, sweep = Math.abs(endAngle - startAngle)
    for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const progress = ((angle - startAngle) * direction % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)
      if (progress <= sweep + 1e-8) points.push({ x: center.x + Math.cos(angle) * radius, z: center.z + Math.sin(angle) * radius })
    }
    return points
  })
}
export function wallWithCurve(wall: Wall, curve: WallCurve): Wall {
  const next = { ...wall, curve }
  return { ...next, start: atWall(next, 0), end: atWall(next, wallLength(next)) }
}
export function wallWithEndpoint(wall: Wall, end: 'start' | 'end', point: Point): Wall {
  if (!wall.curve) return { ...wall, [end]: { ...point } }
  const radius = distance(wall.curve.center, point)
  if (radius < .05) return wall
  const rawAngle = Math.atan2(point.z - wall.curve.center.z, point.x - wall.curve.center.x)
  const reference = end === 'start' ? wall.curve.startAngle : wall.curve.endAngle
  const angle = rawAngle + Math.round((reference - rawAngle) / (Math.PI * 2)) * Math.PI * 2
  return wallWithCurve(wall, { ...wall.curve, radius, [end === 'start' ? 'startAngle' : 'endAngle']: angle })
}
export function nearestWallOffset(wall: Wall, point: Point) {
  const points = wallPoints(wall), segmentLength = wallLength(wall) / Math.max(1, points.length - 1)
  let bestOffset = 0, bestDistance = Infinity
  for (let index = 0; index < points.length - 1; index++) {
    const a = points[index], b = points[index + 1], dx = b.x - a.x, dz = b.z - a.z
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / Math.max(dx * dx + dz * dz, .00001)))
    const gap = distance(point, { x: a.x + dx * t, z: a.z + dz * t })
    if (gap < bestDistance) { bestDistance = gap; bestOffset = (index + t) * segmentLength }
  }
  return { offset: bestOffset, distance: bestDistance }
}
export function wallCurveThroughPoints(start: Point, through: Point, end: Point): WallCurve | null {
  const determinant = 2 * (start.x * (through.z - end.z) + through.x * (end.z - start.z) + end.x * (start.z - through.z))
  if (Math.abs(determinant) < 1e-8) return null
  const startSquared = start.x * start.x + start.z * start.z
  const throughSquared = through.x * through.x + through.z * through.z
  const endSquared = end.x * end.x + end.z * end.z
  const center = {
    x: (startSquared * (through.z - end.z) + throughSquared * (end.z - start.z) + endSquared * (start.z - through.z)) / determinant,
    z: (startSquared * (end.x - through.x) + throughSquared * (start.x - end.x) + endSquared * (through.x - start.x)) / determinant,
  }
  const radius = distance(center, start)
  const startAngle = Math.atan2(start.z - center.z, start.x - center.x)
  const throughAngle = Math.atan2(through.z - center.z, through.x - center.x)
  const endAngle = Math.atan2(end.z - center.z, end.x - center.x)
  const positiveSweep = (endAngle - startAngle + Math.PI * 2) % (Math.PI * 2)
  const throughSweep = (throughAngle - startAngle + Math.PI * 2) % (Math.PI * 2)
  const sweep = throughSweep <= positiveSweep ? positiveSweep : positiveSweep - Math.PI * 2
  return { center, radius, startAngle, endAngle: startAngle + sweep }
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
    const closest = nearestWallOffset(wall, target)
    if (closest.distance < tolerance) return atWall(wall, closest.offset)
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
