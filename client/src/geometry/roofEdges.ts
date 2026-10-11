import type { Point } from '../domain/types'
import type { Vertex } from './roof'
import { containsPoint } from './polygons'

const cross = (x: number, z: number, u: number, v: number) => x * v - z * u
export function clipRoofEdges(edges: [Vertex, Vertex][], footprint: Point[], voids: Point[][]): [Vertex, Vertex][] {
  const onBoundary = (p: Point) => footprint.some((a, i) => {
    const b = footprint[(i + 1) % footprint.length]
    return Math.abs(cross(b.x - a.x, b.z - a.z, p.x - a.x, p.z - a.z)) < 1e-7 &&
      p.x >= Math.min(a.x, b.x) - 1e-7 && p.x <= Math.max(a.x, b.x) + 1e-7 && p.z >= Math.min(a.z, b.z) - 1e-7 && p.z <= Math.max(a.z, b.z) + 1e-7
  })
  return edges.flatMap(([a, b]) => {
    const dx = b[0] - a[0], dz = b[2] - a[2], cuts = [0, 1]
    for (const ring of [footprint, ...voids]) for (let i = 0; i < ring.length; i++) {
      const p = ring[i], q = ring[(i + 1) % ring.length], ux = q.x - p.x, uz = q.z - p.z, denominator = cross(dx, dz, ux, uz)
      if (Math.abs(denominator) < 1e-9) continue
      const t = cross(p.x - a[0], p.z - a[2], ux, uz) / denominator, u = cross(p.x - a[0], p.z - a[2], dx, dz) / denominator
      if (t > 0 && t < 1 && u >= -1e-7 && u <= 1 + 1e-7) cuts.push(t)
    }
    const sorted = [...new Set(cuts)].sort((a, b) => a - b), pieces: [Vertex, Vertex][] = []
    const at = (t: number) => a.map((v, axis) => v + (b[axis] - v) * t) as Vertex
    for (let i = 0; i < sorted.length - 1; i++) {
      const p = at((sorted[i] + sorted[i + 1]) / 2), point = { x: p[0], z: p[2] }
      if ((containsPoint(footprint, point) || onBoundary(point)) && !voids.some(hole => containsPoint(hole, point))) pieces.push([at(sorted[i]), at(sorted[i + 1])])
    }
    return pieces
  })
}
