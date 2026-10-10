import type { Point } from '../domain/types'
import type { Vertex } from './roof'

const side = (a: Point, b: Point, p: Vertex) => (b.x - a.x) * (p[2] - a.z) - (b.z - a.z) * (p[0] - a.x)
function split(polygon: Vertex[], a: Point, b: Point) {
  const inside: Vertex[] = [], outside: Vertex[] = []
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i], q = polygon[(i + 1) % polygon.length], dp = side(a, b, p), dq = side(a, b, q)
    if (dp >= -1e-8) inside.push(p)
    if (dp <= 1e-8) outside.push(p)
    if (dp > 1e-8 && dq < -1e-8 || dp < -1e-8 && dq > 1e-8) {
      const t = dp / (dp - dq), crossing = p.map((v, axis) => v + (q[axis] - v) * t) as Vertex
      inside.push(crossing); outside.push(crossing)
    }
  }
  return { inside, outside }
}
export function subtractRoofTriangle(face: Vertex[], triangle: Point[]): Vertex[][] {
  const pieces: Vertex[][] = []
  let remaining = face
  for (let i = 0; i < triangle.length && remaining.length >= 3; i++) {
    const divided = split(remaining, triangle[i], triangle[(i + 1) % triangle.length])
    if (divided.outside.length >= 3) pieces.push(divided.outside)
    remaining = divided.inside
  }
  return pieces
}
