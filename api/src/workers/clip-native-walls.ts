import type { Intelligence } from '../contracts/analysis'
import { containsPoint } from '../../../client/src/geometry/polygons'
import { validateFootprint, validRing } from '../modules/plan-analysis/footprint-validation'
import { ApiError } from '../security/errors'
type Point = { x: number; z: number }
const cross = (a: Point, b: Point) => a.x * b.z - a.z * b.x
export function clippedIntervals(a: Point, b: Point, ring: Point[]) {
  const d = { x: b.x - a.x, z: b.z - a.z },
    cuts = [0, 1]
  for (let i = 0; i < ring.length; i++) {
    const c = ring[i],
      end = ring[(i + 1) % ring.length],
      e = { x: end.x - c.x, z: end.z - c.z }
    const denominator = cross(d, e)
    if (Math.abs(denominator) < 1e-10) continue
    const delta = { x: c.x - a.x, z: c.z - a.z },
      t = cross(delta, e) / denominator,
      u = cross(delta, d) / denominator
    if (t > 0 && t < 1 && u >= 0 && u <= 1) cuts.push(t)
  }
  const at = (t: number) => ({ x: a.x + d.x * t, z: a.z + d.z * t })
  const sorted = [...new Set(cuts)].sort((x, y) => x - y),
    intervals: [Point, Point][] = []
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] < 1e-8 || !containsPoint(ring, at((sorted[i] + sorted[i - 1]) / 2)))
      continue
    intervals.push([at(sorted[i - 1]), at(sorted[i])])
  }
  return intervals
}
// A measured band may span a real interior wall and then continue across an
// open porch or courtyard. Preserve its exact interior portions, not a bridge
// through outdoor space. Manual targets and fresh AI wall entities are untouched.
export function clipNativeWalls(proposal: Intelligence, width: number, height: number) {
  const ring = proposal.understanding?.footprint.map((p) => ({ x: p.x * width, z: p.y * height }))
  if (!ring?.length || !validRing(ring)) return proposal
  let changed = false
  const candidates = proposal.candidates.flatMap((wall) => {
    if (
      wall.kind !== 'wall' ||
      wall.curve ||
      wall.targetId ||
      !wall.evidence.startsWith('Native source stroke classified as a building wall') ||
      !/^cv_(wall|edge)_/.test(wall.id) ||
      wall.points.length !== 2
    )
      return [wall]
    try {
      validateFootprint(proposal, [wall], width, height)
      return [wall]
    } catch (error) {
      if (!(error instanceof ApiError) || error.code !== 'OUTSIDE_FOOTPRINT') return [wall]
    }
    const [a, b] = wall.points.map((p) => ({ x: p.x * width, z: p.y * height }))
    const pieces = clippedIntervals(a, b, ring).filter(([p, q]) => Math.hypot(p.x - q.x, p.z - q.z) >= 2)
    changed = true
    const note =
      'Native wall band restricted to the interpreted building envelope; outdoor portions remain source evidence.'
    if (!pieces.length)
      return [
        {
          ...wall,
          kind: 'unknown' as const,
          confidence: 0.35,
          uncertainties: [...wall.uncertainties, note].slice(0, 20),
        },
      ]
    return pieces.map((points, index) => ({
      ...wall,
      id: index ? `${wall.id}_part${index}` : wall.id,
      points: points.map((p) => ({ x: p.x / width, y: p.z / height })),
      uncertainties: [...wall.uncertainties, note].slice(0, 20),
    }))
  })
  return changed
    ? {
        ...proposal,
        candidates,
        warnings: [
          ...proposal.warnings,
          'Native wall spans crossing outdoor space were restricted to the source building envelope. Review these junctions and any openings before acceptance.',
        ].slice(0, 100),
      }
    : proposal
}
