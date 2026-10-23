import type { Point } from '../domain/types'
import { containsPoint } from './polygons'
import { signedPlanArea, simplifyPlanPolygon } from './roomTopology'

export type RoofRegion = { footprint: Point[]; voids: Point[][] }
type Edge = { a: Point; b: Point }
const key = (p: Point) => `${p.x.toFixed(5)},${p.z.toFixed(5)}`
const cross = (a: Point, b: Point) => a.x * b.z - a.z * b.x
const sub = (a: Point, b: Point) => ({ x: a.x - b.x, z: a.z - b.z })
function simpleRings(ring: Point[]): Point[][] {
  const seen = new Map<string, number>()
  for (let i = 0; i < ring.length; i++) {
    const previous = seen.get(key(ring[i]))
    if (previous !== undefined)
      return [ring.slice(previous, i), [...ring.slice(0, previous), ...ring.slice(i)]]
        .filter((part) => part.length >= 3)
        .flatMap(simpleRings)
    seen.set(key(ring[i]), i)
  }
  return [ring]
}

// Union the accepted faces before designing a roof. Internal room edges vanish.
export function roofRegions(polygons: Point[][], excluded: Point[][] = []): RoofRegion[] {
  const edges: Edge[] = [...polygons, ...excluded].flatMap((polygon) =>
    polygon.map((a, i) => ({ a, b: polygon[(i + 1) % polygon.length] })),
  )
  const boundary = new Map<string, Edge>(),
    inside = (p: Point) =>
      polygons.some((polygon) => containsPoint(polygon, p)) &&
      !excluded.some((polygon) => containsPoint(polygon, p))
  for (const edge of edges) {
    const direction = sub(edge.b, edge.a),
      length = Math.hypot(direction.x, direction.z)
    if (length < 1e-6) continue
    const cuts = [0, 1],
      at = (t: number) => ({ x: edge.a.x + direction.x * t, z: edge.a.z + direction.z * t })
    for (const other of edges) {
      const v = sub(other.b, other.a),
        delta = sub(other.a, edge.a),
        denominator = cross(direction, v)
      if (Math.abs(denominator) > 1e-8) {
        const t = cross(delta, v) / denominator,
          u = cross(delta, direction) / denominator
        if (t > 0 && t < 1 && u >= -1e-7 && u <= 1 + 1e-7) cuts.push(t)
      } else if (Math.abs(cross(direction, delta)) / length < 1e-5) {
        for (const p of [other.a, other.b]) {
          const d = sub(p, edge.a),
            t = (d.x * direction.x + d.z * direction.z) / (length * length)
          if (t > 0 && t < 1) cuts.push(t)
        }
      }
    }
    const sorted = [...new Set(cuts.map((t) => Math.round(t * 1e9) / 1e9))].sort((a, b) => a - b)
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = at(sorted[i]),
        b = at(sorted[i + 1]),
        middle = at((sorted[i] + sorted[i + 1]) / 2)
      if (Math.hypot(b.x - a.x, b.z - a.z) < 1e-5) continue
      const nx = (-direction.z / length) * 2e-5,
        nz = (direction.x / length) * 2e-5
      const left = inside({ x: middle.x + nx, z: middle.z + nz }),
        right = inside({ x: middle.x - nx, z: middle.z - nz })
      if (left === right) continue
      const oriented = left ? { a, b } : { a: b, b: a }
      boundary.set(`${key(oriented.a)}|${key(oriented.b)}`, oriented)
    }
  }
  const unused = new Set(boundary.values()),
    outgoing = new Map<string, Edge[]>()
  for (const edge of unused) outgoing.set(key(edge.a), [...(outgoing.get(key(edge.a)) || []), edge])
  const rings: Point[][] = []
  while (unused.size) {
    const first = unused.values().next().value!,
      ring: Point[] = []
    let current = first,
      closed = false
    for (let i = 0; i <= boundary.size; i++) {
      unused.delete(current)
      ring.push(current.a)
      if (key(current.b) === key(first.a)) {
        closed = true
        break
      }
      const incoming = sub(current.b, current.a)
      const next = (outgoing.get(key(current.b)) || [])
        .filter((edge) => unused.has(edge))
        .sort((a, b) => {
          const angle = (edge: Edge) => {
            const v = sub(edge.b, edge.a)
            return Math.atan2(cross(incoming, v), incoming.x * v.x + incoming.z * v.z)
          }
          return angle(b) - angle(a)
        })[0]
      if (!next) break
      current = next
    }
    if (closed)
      rings.push(
        ...simpleRings(ring)
          .filter((part) => Math.abs(signedPlanArea(part)) > 1e-5)
          .map(simplifyPlanPolygon),
      )
  }
  const regions = rings
    .filter((ring) => signedPlanArea(ring) > 0)
    .map((footprint) => ({ footprint, voids: [] as Point[][] }))
  for (const hole of rings.filter((ring) => signedPlanArea(ring) < 0)) {
    const owner = regions
      .filter((region) => containsPoint(region.footprint, hole[0]))
      .sort((a, b) => signedPlanArea(a.footprint) - signedPlanArea(b.footprint))[0]
    owner?.voids.push(hole)
  }
  return regions
}
