import type { Point } from '../domain/types'
import { signedPlanArea, simplifyPlanPolygon } from './roomTopology'

// Offset each boundary edge outward; bound acute-corner mitres to four overhangs.
export function roofOverhang(footprint: Point[], distance: number): Point[] {
  if (distance <= 0) return footprint
  const points = simplifyPlanPolygon(footprint)
  if (signedPlanArea(points) < 0) points.reverse()
  const unit = (a: Point, b: Point) => {
    const length = Math.hypot(b.x - a.x, b.z - a.z) || 1
    return { x: (b.x - a.x) / length, z: (b.z - a.z) / length }
  }
  const cross = (a: Point, b: Point) => a.x * b.z - a.z * b.x
  return points.flatMap((point, index) => {
    const incoming = unit(points[(index + points.length - 1) % points.length], point)
    const outgoing = unit(point, points[(index + 1) % points.length])
    const a = { x: point.x + incoming.z * distance, z: point.z - incoming.x * distance }
    const b = { x: point.x + outgoing.z * distance, z: point.z - outgoing.x * distance }
    const denominator = cross(incoming, outgoing)
    if (Math.abs(denominator) < 1e-8) return [a]
    const along = cross({ x: b.x - a.x, z: b.z - a.z }, outgoing) / denominator
    const intersection = { x: a.x + incoming.x * along, z: a.z + incoming.z * along }
    return Math.hypot(intersection.x - point.x, intersection.z - point.z) <= distance * 4 ? [intersection] : [a, b]
  })
}
