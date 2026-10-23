import type { Point, Roof } from '../domain/types'
import { roofLayout, type Vertex } from './roof'
import { clipRoofLayout } from './roofFootprint'
import { roofOverhang } from './roofOverhang'

function faceArea(vertices: Vertex[]) {
  let area = 0
  for (let i = 1; i < vertices.length - 1; i++) {
    const [a, b, c] = [vertices[0], vertices[i], vertices[i + 1]]
    const ux = b[0] - a[0],
      uy = b[1] - a[1],
      uz = b[2] - a[2]
    const vx = c[0] - a[0],
      vy = c[1] - a[1],
      vz = c[2] - a[2]
    area += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2
  }
  return area
}

export function roofSurfaceArea(
  footprint: Point[],
  roof: Roof,
  top: number,
  clipped = false,
  voids: Point[][] = [],
): number {
  if (footprint.length < 3) return 0
  const xs = footprint.map((point) => point.x),
    zs = footprint.map((point) => point.z)
  const layout = roofLayout(
    { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs), top },
    roof,
  )
  const faces = clipped
    ? clipRoofLayout(layout, roofOverhang(footprint, roof.overhang), voids).faces
    : layout.faces
  return faces.reduce((sum, face) => sum + faceArea(face), 0)
}
