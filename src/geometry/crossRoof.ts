import type { Roof } from '../domain/types'
import type { RoofBounds, RoofFace, RoofLayout, Vertex } from './roof'

export function crossRoofHeightAt(bounds: RoofBounds, roof: Roof, x: number, z: number) {
  const x0 = bounds.minX - roof.overhang, x1 = bounds.maxX + roof.overhang
  const z0 = bounds.minZ - roof.overhang, z1 = bounds.maxZ + roof.overhang
  const alongX = roof.ridgeDirection === 'x' || (roof.ridgeDirection !== 'z' && x1 - x0 >= z1 - z0)
  const longMin = alongX ? x0 : z0, longMax = alongX ? x1 : z1
  const crossMin = alongX ? z0 : x0, crossMax = alongX ? z1 : x1
  const longMid = (longMin + longMax) / 2
  const wingHalf = Math.min((longMax - longMin) * .44, (crossMax - crossMin) * .54)
  const slope = Math.tan(roof.pitch * Math.PI / 180)
  const eave = bounds.top + (roof.elevationOffset || 0) + .12
  const hip = roof.shape === 'cross-hip'
  const along = alongX ? x : z, across = alongX ? z : x
  const crossDistance = Math.max(0, Math.min(across - crossMin, crossMax - across))
  const longDistance = Math.max(0, Math.min(along - longMin, longMax - along))
  const wingDistance = wingHalf - Math.abs(along - longMid)
  const main = eave + Math.min(crossDistance, hip ? longDistance : Infinity) * slope
  const wing = wingDistance >= 0
    ? eave + Math.min(wingDistance, hip ? crossDistance : Infinity) * slope + (hip ? .28 : 0)
    : -Infinity
  return Math.max(main, wing)
}

export function crossRoofLayout(bounds: RoofBounds, roof: Roof): RoofLayout {
  const x0 = bounds.minX - roof.overhang, x1 = bounds.maxX + roof.overhang
  const z0 = bounds.minZ - roof.overhang, z1 = bounds.maxZ + roof.overhang
  const columns = Math.min(28, Math.max(12, Math.ceil((x1 - x0) / .65)))
  const rows = Math.min(28, Math.max(12, Math.ceil((z1 - z0) / .65)))
  const vertex = (column: number, row: number): Vertex => {
    const x = x0 + (x1 - x0) * column / columns
    const z = z0 + (z1 - z0) * row / rows
    return [x, crossRoofHeightAt(bounds, roof, x, z), z]
  }
  const faces: RoofFace[] = []
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const a = vertex(column, row), b = vertex(column + 1, row)
    const c = vertex(column + 1, row + 1), d = vertex(column, row + 1)
    faces.push([a, c, b], [a, d, c])
  }
  return { faces, gables: [], eaves: [], ridge: [] }
}
