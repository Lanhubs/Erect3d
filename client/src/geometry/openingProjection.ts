import type { Wall, Point } from '../domain/types'
import { wallLength } from './math'
export function projectOpening(wall: Wall, points: Point[]) {
  const length = wallLength(wall),
    curve = wall.curve
  const projected = points.map((point) => {
    if (curve) {
      const raw = Math.atan2(point.z - curve.center.z, point.x - curve.center.x),
        middle = (curve.startAngle + curve.endAngle) / 2
      const angle = raw + Math.round((middle - raw) / (2 * Math.PI)) * 2 * Math.PI
      return {
        offset: (angle - curve.startAngle) * curve.radius * Math.sign(curve.endAngle - curve.startAngle),
        distance: Math.abs(Math.hypot(point.x - curve.center.x, point.z - curve.center.z) - curve.radius),
      }
    }
    const dx = wall.end.x - wall.start.x,
      dz = wall.end.z - wall.start.z
    return {
      offset: ((point.x - wall.start.x) * dx + (point.z - wall.start.z) * dz) / length,
      distance: Math.abs((point.x - wall.start.x) * dz - (point.z - wall.start.z) * dx) / length,
    }
  })
  if (
    points.length !== 2 ||
    projected.some(
      (p) =>
        !Number.isFinite(p.offset) ||
        p.offset < -0.001 ||
        p.offset > length + 0.001 ||
        p.distance > wall.thickness / 2 + 0.02,
    )
  )
    return null
  return {
    offset: Math.max(0, Math.min(...projected.map((p) => p.offset))),
    width: Math.abs(projected[1].offset - projected[0].offset),
  }
}
