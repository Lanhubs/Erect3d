import type { Point } from '../domain/types'
import type { RoofFace, Vertex } from './roof'

function heightOnTriangle(point: Point, a: Vertex, b: Vertex, c: Vertex) {
  const determinant = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2])
  if (Math.abs(determinant) < 1e-10) return null
  const u = ((b[2] - c[2]) * (point.x - c[0]) + (c[0] - b[0]) * (point.z - c[2])) / determinant
  const v = ((c[2] - a[2]) * (point.x - c[0]) + (a[0] - c[0]) * (point.z - c[2])) / determinant
  return {
    inside: u >= -1e-6 && v >= -1e-6 && u + v <= 1 + 1e-6,
    height: u * a[1] + v * b[1] + (1 - u - v) * c[1],
  }
}
export function roofHeightAt(faces: RoofFace[], point: Point) {
  for (const face of faces)
    for (let i = 1; i < face.length - 1; i++) {
      const result = heightOnTriangle(point, face[0], face[i], face[i + 1])
      if (result?.inside) return result.height
    }
  return null
}
// Close the vertical gap at the real wall line, including re-entrant and courtyard edges.
// Split at surface seams so the top edge follows the chosen roof exactly.
export function roofClosurePanels(rings: Point[][], faces: RoofFace[], wallTop: number): RoofFace[] {
  const triangles = faces.flatMap((face) =>
    Array.from({ length: face.length - 2 }, (_, i) => [face[0], face[i + 1], face[i + 2]]),
  )
  const panels: RoofFace[] = []
  for (const ring of rings)
    for (let index = 0; index < ring.length; index++) {
      const a = ring[index],
        b = ring[(index + 1) % ring.length],
        dx = b.x - a.x,
        dz = b.z - a.z
      const cuts = [0, 1]
      for (const triangle of triangles)
        for (let j = 0; j < 3; j++) {
          const c = triangle[j],
            d = triangle[(j + 1) % 3],
            ex = d[0] - c[0],
            ez = d[2] - c[2]
          const determinant = dx * ez - dz * ex
          if (Math.abs(determinant) < 1e-10) continue
          const t = ((c[0] - a.x) * ez - (c[2] - a.z) * ex) / determinant
          const u = ((c[0] - a.x) * dz - (c[2] - a.z) * dx) / determinant
          if (t > 1e-7 && t < 1 - 1e-7 && u >= -1e-7 && u <= 1 + 1e-7) cuts.push(t)
        }
      const sorted = [...new Set(cuts.map((t) => Number(t.toFixed(8))))].sort((x, z) => x - z)
      const at = (t: number): Point => ({ x: a.x + dx * t, z: a.z + dz * t })
      for (let j = 0; j < sorted.length - 1; j++) {
        const p = at(sorted[j]),
          q = at(sorted[j + 1]),
          midpoint = at((sorted[j] + sorted[j + 1]) / 2)
        const triangle = triangles.find(([x, y, z]) => heightOnTriangle(midpoint, x, y, z)?.inside)
        if (!triangle) continue
        const highP = Math.max(
          wallTop,
          heightOnTriangle(p, ...(triangle as [Vertex, Vertex, Vertex]))!.height - 0.04,
        )
        const highQ = Math.max(
          wallTop,
          heightOnTriangle(q, ...(triangle as [Vertex, Vertex, Vertex]))!.height - 0.04,
        )
        if (Math.max(highP, highQ) - wallTop < 0.005) continue
        panels.push([
          [p.x, wallTop, p.z],
          [q.x, wallTop, q.z],
          [q.x, highQ, q.z],
          [p.x, highP, p.z],
        ])
      }
    }
  return panels
}
