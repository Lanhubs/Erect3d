import { canopyRegions } from './canopyRegions'
import { arenaCanopyGrid } from './arenaCanopyGrid'
export type CanopyParameters = {
  radiusX: number
  radiusZ: number
  center: { x: number; z: number }
  rotation: number
  rise: number
  coverage: 'full' | 'partial' | 'open'
  top: number
  segments: number
  rows: number
}
export type CanopyBuffers = {
  positions: Float32Array
  uvs: Float32Array
  normals: Float32Array
  indices: Uint32Array
  metalCount: number
  regions: [number, number, number, number]
}
export function arenaCanopyBuffers(p: CanopyParameters): CanopyBuffers {
  if (p.coverage !== 'open') return arenaCanopyGrid(p)
  const { radiusX: rx, radiusZ: rz, center, rotation, rise, top, rows, segments } = p,
    c = Math.cos(rotation),
    s = Math.sin(rotation)
  const open = true,
    sweep = Math.PI * 2,
    start = 0
  const positions: number[] = [],
    uvs: number[] = [],
    metal: number[] = [],
    glass: number[] = [],
    closure: number[] = []
  const point = (r: number, theta: number) => {
    const x = rx * r * Math.cos(theta),
      z = rz * r * Math.sin(theta)
    return [
      center.x + x * c - z * s,
      top + rise * (1 - (x / rx) ** 2) * (0.9 + 0.1 * (1 - (z / rz) ** 2)),
      center.z + x * s + z * c,
    ]
  }
  const index = (row: number, column: number) =>
    open ? row * (segments + 1) + column : row === 0 ? 0 : 1 + (row - 1) * (segments + 1) + column
  for (let row = 0; row <= rows; row++)
    for (let column = 0; column <= segments; column++) {
      if (!open && row === 0 && column > 0) continue
      const r = (open ? 0.76 : 0) + ((open ? 0.24 : 1) * row) / rows,
        theta = start + (column / segments) * sweep
      positions.push(...point(r, theta))
      uvs.push((Math.cos(theta) * r + 1) * 0.5, (Math.sin(theta) * r + 1) * 0.5)
    }
  for (let row = 0; row < rows; row++)
    for (let column = 0; column < segments; column++) {
      const a = index(row, column),
        b = index(row, column + 1),
        d = index(row + 1, column),
        e = index(row + 1, column + 1)
      const r = (open ? 0.76 : 0) + ((open ? 0.24 : 1) * (row + 0.5)) / rows,
        theta = start + ((column + 0.5) / segments) * sweep
      const x = r * Math.cos(theta),
        z = r * Math.sin(theta),
        target = Math.abs(x) > 0.09 && Math.abs(x) < 0.32 && z < -0.08 && z > -0.8 && !open ? glass : metal
      if (!open && row === 0) target.push(a, e, d)
      else target.push(a, b, d, b, e, d)
    }
  for (let column = 0; column < segments; column++) {
    const a = index(rows, column),
      b = index(rows, column + 1)
    positions.push(
      positions[a * 3],
      positions[a * 3 + 1] - 0.25,
      positions[a * 3 + 2],
      positions[b * 3],
      positions[b * 3 + 1] - 0.25,
      positions[b * 3 + 2],
    )
    uvs.push(0, 0, 1, 0)
    // The vaulted eave changes height around the ellipse. Close the volume
    // above the constant-height façade rather than leaving a floating roof.
    const low = positions.length / 3
    if (positions[a * 3 + 1] > top + 0.001 && positions[b * 3 + 1] > top + 0.001) {
      positions.push(positions[a * 3], top, positions[a * 3 + 2], positions[b * 3], top, positions[b * 3 + 2])
      uvs.push(0, 0, 1, 0)
      closure.push(a, low, b, b, low, low + 1)
    }
  }
  return canopyRegions(positions, uvs, metal, glass, closure)
}
