import { validRing } from '../modules/plan-analysis/footprint-validation'
import { roofRegions } from '../../../client/src/geometry/roofRegions'
type Point = { x: number; z: number }
const cross = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)
function coincidentSourceEdges(ring: Point[], supported: (a: Point, b: Point) => boolean) {
  if (ring.length > 128) return ring
  const next = ring.map((point) => ({ ...point }))
  let changed = false
  for (const axis of ['x', 'z'] as const) {
    const other = axis === 'x' ? 'z' : 'x'
    for (let i = 0; i < next.length; i++)
      for (let j = i + 1; j < next.length; j++) {
        const a = next[i],
          b = next[j],
          distance = Math.abs(a[axis] - b[axis])
        if (distance < 0.01 || distance > 4 || Math.abs(a[other] - b[other]) < 8) continue
        const coordinate = (a[axis] + b[axis]) / 2
        if (!supported({ ...a, [axis]: coordinate }, { ...b, [axis]: coordinate })) continue
        const first = a[axis],
          last = b[axis]
        for (const point of next) if (point[axis] === first || point[axis] === last) point[axis] = coordinate
        changed = true
      }
  }
  if (!changed) return ring
  const regions = roofRegions([next])
  return regions.length === 1 && !regions[0].voids.length && validRing(regions[0].footprint)
    ? regions[0].footprint
    : ring
}
// Correct an ordering mistake only when BOTH replacement edges follow source ink.
// Keep every source vertex; never substitute a bounding box or convex hull.
export function uncrossSourceRing(ring: Point[], supported: (a: Point, b: Point) => boolean) {
  if (validRing(ring) || ring.length > 1024) return ring
  const coincident = coincidentSourceEdges(ring, supported)
  if (coincident !== ring) return coincident
  let next = [...ring]
  for (let attempt = 0; attempt < 16; attempt++) {
    let repaired = false
    for (let i = 0; i < next.length && !repaired; i++) {
      const a = next[i],
        b = next[(i + 1) % next.length]
      for (let j = i + 2; j < next.length; j++) {
        if ((j + 1) % next.length === i) continue
        const c = next[j],
          d = next[(j + 1) % next.length]
        if (cross(a, b, c) * cross(a, b, d) >= -1e-10 || cross(c, d, a) * cross(c, d, b) >= -1e-10) continue
        if (!supported(a, c) || !supported(b, d)) return ring
        next = [...next.slice(0, i + 1), ...next.slice(i + 1, j + 1).reverse(), ...next.slice(j + 1)]
        repaired = true
        break
      }
    }
    if (validRing(next)) return next
    if (!repaired) break
  }
  return ring
}
