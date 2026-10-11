import type { Point, Wall } from '../domain/types'
import { advance, subtract, wallLine } from './planLines'

const cross = (a: Point, b: Point) => a.x * b.z - a.z * b.x
export const signedPlanArea = (polygon: Point[]) => polygon.reduce((sum, a, index) => {
  const b = polygon[(index + 1) % polygon.length]
  return sum + a.x * b.z - b.x * a.z
}, 0) / 2
export function simplifyPlanPolygon(polygon: Point[]) {
  return polygon.filter((b, index) => {
    const a = polygon[(index + polygon.length - 1) % polygon.length], c = polygon[(index + 1) % polygon.length]
    return Math.abs(cross(subtract(b, a), subtract(c, a))) > .005 * Math.max(.1, Math.hypot(c.x - a.x, c.z - a.z))
  })
}

// Split the semantic wall network at junctions, then walk its bounded faces.
// Door and window hosts remain continuous boundaries for finding room interiors.
export function enclosedSpaces(walls: Wall[]): Point[][] {
  const lines = walls.map(wallLine), cuts = lines.map(line => line ? [0, line.length] : [])
  for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
    const a = lines[i], b = lines[j]
    if (!a || !b) continue
    const denominator = cross(a.unit, b.unit)
    if (Math.abs(denominator) < .04) continue
    const delta = subtract(b.start, a.start), ta = cross(delta, b.unit) / denominator, tb = cross(delta, a.unit) / denominator
    const tolerance = Math.max(.12, Math.min(.35, (walls[i].thickness + walls[j].thickness) * .65))
    if (ta < -tolerance || tb < -tolerance || ta > a.length + tolerance || tb > b.length + tolerance) continue
    if (Math.abs(ta) < tolerance) cuts[i][0] = ta
    if (Math.abs(ta - a.length) < tolerance) cuts[i][1] = ta
    if (Math.abs(tb) < tolerance) cuts[j][0] = tb
    if (Math.abs(tb - b.length) < tolerance) cuts[j][1] = tb
    cuts[i].push(ta); cuts[j].push(tb)
  }
  const nodes: Point[] = [], neighbours: Set<number>[] = [], buckets = new Map<string, number[]>()
  const nodeAt = (point: Point) => {
    const gx = Math.floor(point.x / .08), gz = Math.floor(point.z / .08)
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++)
      for (const index of buckets.get(`${gx + dx}:${gz + dz}`) || [])
        if (Math.hypot(nodes[index].x - point.x, nodes[index].z - point.z) < .065) return index
    const index = nodes.length, key = `${gx}:${gz}`
    nodes.push(point); neighbours.push(new Set())
    buckets.set(key, [...buckets.get(key) || [], index])
    return index
  }
  lines.forEach((line, index) => {
    if (!line) return
    const positions = [...new Set(cuts[index])].sort((a, b) => a - b)
    for (let at = 0; at < positions.length - 1; at++) {
      if (positions[at + 1] - positions[at] < .04) continue
      const a = nodeAt(advance(line.start, line.unit, positions[at])), b = nodeAt(advance(line.start, line.unit, positions[at + 1]))
      if (a !== b) { neighbours[a].add(b); neighbours[b].add(a) }
    }
  })
  const leaves = neighbours.map((edges, index) => edges.size < 2 ? index : -1).filter(index => index >= 0)
  for (let at = 0; at < leaves.length; at++) {
    const node = leaves[at]
    for (const adjacent of neighbours[node]) { neighbours[adjacent].delete(node); if (neighbours[adjacent].size === 1) leaves.push(adjacent) }
    neighbours[node].clear()
  }
  const ordered = neighbours.map((edges, index) => [...edges].sort((a, b) =>
    Math.atan2(nodes[a].z - nodes[index].z, nodes[a].x - nodes[index].x) - Math.atan2(nodes[b].z - nodes[index].z, nodes[b].x - nodes[index].x)))
  const visited = new Set<string>(), spaces: Point[][] = []
  for (let start = 0; start < nodes.length; start++) for (const next of ordered[start]) {
    if (visited.has(`${start}:${next}`)) continue
    let a = start, b = next, closed = false
    const polygon: Point[] = []
    for (let step = 0; step <= walls.length * 8; step++) {
      const key = `${a}:${b}`
      if (visited.has(key)) { closed = a === start && b === next; break }
      visited.add(key); polygon.push(nodes[a])
      const edges = ordered[b], incoming = edges.indexOf(a)
      const c = edges[(incoming + edges.length - 1) % edges.length]
      a = b; b = c
    }
    if (!closed || signedPlanArea(polygon) < .6) continue
    const simple = simplifyPlanPolygon(polygon)
    const xs = simple.map(point => point.x), zs = simple.map(point => point.z)
    if (simple.length >= 3 && Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) > .5) spaces.push(simple)
  }
  return spaces.sort((a, b) => signedPlanArea(b) - signedPlanArea(a))
}
