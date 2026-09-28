import type { Point } from '../domain/types'

export function containsPoint(polygon: Point[], point: Point) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j]
    if ((a.z > point.z) !== (b.z > point.z) && point.x < (b.x - a.x) * (point.z - a.z) / (b.z - a.z) + a.x) inside = !inside
  }
  return inside
}
export function containsPolygon(outer: Point[], inner: Point[]) {
  return inner.length >= 3 && inner.every(point => containsPoint(outer, point))
}
