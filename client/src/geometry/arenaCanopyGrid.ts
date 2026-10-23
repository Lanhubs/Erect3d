import { canopyRegions } from './canopyRegions'
import type { CanopyParameters, CanopyBuffers } from './arenaCanopyBuffers'
type Point = { x: number; z: number }
// The grid contains the exact skylight boundaries. Glazing replaces the metal
// cells, so the two rectangular daylight banks have no jagged or overlapping edges.
export function arenaCanopyGrid(p: CanopyParameters): CanopyBuffers {
  const { radiusX: rx, radiusZ: rz, center, rotation, top, rise } = p,
    c = Math.cos(rotation),
    s = Math.sin(rotation)
  const partial = p.coverage === 'partial',
    segments = p.segments
  const ring = Array.from({ length: segments }, (_, i) => ({
    x: rx * Math.cos((i / segments) * Math.PI * 2),
    z: rz * Math.sin((i / segments) * Math.PI * 2),
  }))
  const xs = [
    ...new Set([
      ...Array.from({ length: p.rows * 2 + 1 }, (_, i) => -rx + (2 * rx * i) / (p.rows * 2)),
      ...[-0.32, -0.09, 0.09, 0.32].map((x) => x * rx),
    ]),
  ].sort((a, b) => a - b)
  const zs = [
    ...new Set([
      ...Array.from({ length: p.rows * 2 + 1 }, (_, i) => -rz + (2 * rz * i) / (p.rows * 2)),
      -0.8 * rz,
      -0.08 * rz,
      0,
    ]),
  ]
    .filter((z) => !partial || z <= 0)
    .sort((a, b) => a - b)
  const positions: number[] = [],
    uvs: number[] = [],
    metal: number[] = [],
    glass: number[] = [],
    fascia: number[] = [],
    vertices = new Map<string, number>()
  const height = (x: number, z: number) =>
    top + rise * (1 - (x / rx) ** 2) * (0.9 + 0.1 * (1 - (z / rz) ** 2))
  const vertex = (point: Point) => {
    const key = `${point.x.toFixed(6)}:${point.z.toFixed(6)}`,
      prior = vertices.get(key)
    if (prior !== undefined) return prior
    const index = positions.length / 3
    positions.push(
      center.x + point.x * c - point.z * s,
      height(point.x, point.z),
      center.z + point.x * s + point.z * c,
    )
    uvs.push((point.x / rx + 1) * 0.5, (point.z / rz + 1) * 0.5)
    vertices.set(key, index)
    return index
  }
  const cross = (a: Point, b: Point, q: Point) => (b.x - a.x) * (q.z - a.z) - (b.z - a.z) * (q.x - a.x)
  const clip = (input: Point[]) => {
    let polygon = input
    for (let i = 0; i < ring.length && polygon.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length],
        result: Point[] = []
      for (let j = 0; j < polygon.length; j++) {
        const q = polygon[j],
          r = polygon[(j + 1) % polygon.length],
          dq = cross(a, b, q),
          dr = cross(a, b, r)
        if (dq >= -1e-8) result.push(q)
        if (dq >= 0 !== dr >= 0) {
          const t = dq / (dq - dr)
          result.push({ x: q.x + (r.x - q.x) * t, z: q.z + (r.z - q.z) * t })
        }
      }
      polygon = result
    }
    return polygon
  }
  for (let i = 0; i < xs.length - 1; i++)
    for (let j = 0; j < zs.length - 1; j++) {
      const a = xs[i],
        b = xs[i + 1],
        d = zs[j],
        e = zs[j + 1],
        nearestX = Math.max(a, Math.min(b, 0)),
        nearestZ = Math.max(d, Math.min(e, 0))
      if ((nearestX / rx) ** 2 + (nearestZ / rz) ** 2 > 1) continue
      const polygon = clip([
        { x: a, z: d },
        { x: b, z: d },
        { x: b, z: e },
        { x: a, z: e },
      ])
      if (polygon.length < 3) continue
      const midX = (a + b) / 2 / rx,
        midZ = (d + e) / 2 / rz,
        target = Math.abs(midX) > 0.09 && Math.abs(midX) < 0.32 && midZ < -0.08 && midZ > -0.8 ? glass : metal
      const indices = polygon.map(vertex)
      for (let k = 1; k < indices.length - 1; k++) {
        if (Math.abs(cross(polygon[0], polygon[k], polygon[k + 1])) > 1e-7)
          target.push(indices[0], indices[k + 1], indices[k])
      }
    }
  // Curved roof sides close against the façade's constant top elevation.
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length]
    if (partial && (a.z > 1e-6 || b.z > 1e-6)) continue
    const ai = vertex(a),
      bi = vertex(b),
      lower = positions.length / 3
    positions.push(
      positions[ai * 3],
      top,
      positions[ai * 3 + 2],
      positions[bi * 3],
      top,
      positions[bi * 3 + 2],
    )
    uvs.push(0, 0, 1, 0)
    if (height(a.x, a.z) > top + 0.0001) fascia.push(ai, lower, bi)
    if (height(b.x, b.z) > top + 0.0001) fascia.push(bi, lower, lower + 1)
  }
  return canopyRegions(positions, uvs, metal, glass, fascia)
}
