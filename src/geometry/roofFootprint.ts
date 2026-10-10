import type { Point } from '../domain/types'
import type { RoofLayout, Vertex } from './roof'
import { signedPlanArea, simplifyPlanPolygon } from './roomTopology'
import { containsPoint } from './polygons'
import { subtractRoofTriangle } from './roofCutouts'
import { clipRoofEdges } from './roofEdges'

const side = (a: Point, b: Point, p: Point) => (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x)
export function footprintTriangles(input: Point[]): Point[][] {
  const points = simplifyPlanPolygon(input)
  if (signedPlanArea(points) < 0) points.reverse()
  const remaining = points.map((_, index) => index), triangles: Point[][] = []
  while (remaining.length > 3) {
    let found = false
    for (let index = 0; index < remaining.length; index++) {
      const ia = remaining[(index + remaining.length - 1) % remaining.length], ib = remaining[index], ic = remaining[(index + 1) % remaining.length]
      const a = points[ia], b = points[ib], c = points[ic]
      if (side(a, b, c) <= 1e-8 || remaining.some(other => other !== ia && other !== ib && other !== ic &&
        side(a, b, points[other]) >= -1e-8 && side(b, c, points[other]) >= -1e-8 && side(c, a, points[other]) >= -1e-8)) continue
      triangles.push([a, b, c]); remaining.splice(index, 1); found = true; break
    }
    if (!found) return []
  }
  if (remaining.length === 3) triangles.push(remaining.map(index => points[index]))
  return triangles
}

function clipFace(face: Vertex[], triangle: Point[]) {
  let polygon = face
  for (let edge = 0; edge < triangle.length; edge++) {
    const a = triangle[edge], b = triangle[(edge + 1) % triangle.length], output: Vertex[] = []
    const distance = (vertex: Vertex) => side(a, b, { x: vertex[0], z: vertex[2] })
    for (let index = 0; index < polygon.length; index++) {
      const start = polygon[index], end = polygon[(index + 1) % polygon.length], ds = distance(start), de = distance(end)
      if ((ds >= -1e-8) !== (de >= -1e-8)) {
        const t = ds / (ds - de)
        output.push(start.map((value, axis) => value + (end[axis] - value) * t) as Vertex)
      }
      if (de >= -1e-8) output.push(end)
    }
    polygon = output
  }
  return polygon
}

export function clipRoofLayout(layout: RoofLayout, footprint: Point[], voids: Point[][] = []): RoofLayout {
  if (footprint.length < 3) return { faces: [], eaves: [], ridge: [], gables: [] }
  let faces: Vertex[][] = []
  for (const triangle of footprintTriangles(footprint)) for (const face of layout.faces) {
    const clipped = clipFace(face, triangle)
    for (let index = 1; index < clipped.length - 1; index++) {
      const vertices = [clipped[0], clipped[index], clipped[index + 1]]
      if (Math.abs(signedPlanArea(vertices.map(([x, , z]) => ({ x, z })))) > 1e-8) faces.push(vertices)
    }
  }
  for (const hole of voids) for (const triangle of footprintTriangles(hole)) {
    faces = faces.flatMap(face => subtractRoofTriangle(face, triangle)).flatMap(polygon =>
      polygon.slice(1, -1).map((_, i) => [polygon[0], polygon[i + 1], polygon[i + 2]]))
      .filter(face => Math.abs(signedPlanArea(face.map(([x, , z]) => ({ x, z })))) > 1e-8)
  }
  const inside = (vertex: Vertex) => {
    const p = { x: vertex[0], z: vertex[2] }
    if (voids.some(hole => containsPoint(hole, p))) return false
    return containsPoint(footprint, p) || footprint.some((a, index) => {
      const b = footprint[(index + 1) % footprint.length]
      return Math.abs(side(a, b, p)) < 1e-6 && p.x >= Math.min(a.x, b.x) - 1e-6 && p.x <= Math.max(a.x, b.x) + 1e-6 &&
        p.z >= Math.min(a.z, b.z) - 1e-6 && p.z <= Math.max(a.z, b.z) + 1e-6
    })
  }
  return { faces, gables: layout.gables.filter(face => face.every(inside)), eaves: clipRoofEdges(layout.eaves, footprint, voids), ridge: clipRoofEdges(layout.ridge, footprint, voids) }
}
