import type { Intelligence } from '../contracts/analysis'
import { containsPoint } from '../../../client/src/geometry/polygons'
import { validRing } from '../modules/plan-analysis/footprint-validation'
type Point = { x: number; z: number }

// Repair a small overrun at a real perpendicular junction, not a detached wall
// or an arbitrary envelope edge. Both retained spans must have source ink.
export function joinSourceWallEnds(
  proposal: Intelligence,
  width: number,
  height: number,
  supported: (a: Point, b: Point) => boolean,
): Intelligence {
  const pixel = (p: { x: number; y: number }) => ({ x: p.x * width, z: p.y * height })
  const ring = proposal.understanding?.footprint.map(pixel) || []
  if (!validRing(ring)) return proposal
  const walls = proposal.candidates.filter(
    (candidate) =>
      candidate.kind === 'wall' &&
      !candidate.curve &&
      candidate.points.length === 2 &&
      candidate.confidence >= 0.7,
  )
  const candidates = proposal.candidates.map((wall) => {
    if (!walls.includes(wall) || wall.targetId || /^cv_/.test(wall.id)) return wall
    const points = wall.points.map(pixel),
      length = Math.hypot(points[1].x - points[0].x, points[1].z - points[0].z)
    const tolerance = Math.min(16, Math.max(3, (wall.thickness || 0.004) * width * 1.5))
    let changed = false
    for (const index of [0, 1]) {
      const end = points[index],
        start = points[1 - index]
      if (containsPoint(ring, end) || !containsPoint(ring, start)) continue
      const dx = end.x - start.x,
        dz = end.z - start.z
      const matches: { point: Point; distance: number }[] = []
      for (const host of walls) {
        if (host.id === wall.id) continue
        const [a, b] = host.points.map(pixel),
          hx = b.x - a.x,
          hz = b.z - a.z,
          hostLength = Math.hypot(hx, hz)
        if (!length || !hostLength || Math.abs((dx * hx + dz * hz) / (length * hostLength)) > 0.1) continue
        const determinant = dx * hz - dz * hx
        const t = ((a.x - start.x) * hz - (a.z - start.z) * hx) / determinant
        const u = ((a.x - start.x) * dz - (a.z - start.z) * dx) / determinant
        if (t < 0.8 || t > 1 || u < 0 || u > 1) continue
        const point = { x: start.x + t * dx, z: start.z + t * dz },
          distance = Math.hypot(end.x - point.x, end.z - point.z)
        if (distance > tolerance || !supported(start, point) || !supported(a, b)) continue
        // A point exactly on the envelope may be reported outside by a winding
        // test. The supported host, not the envelope, defines this junction.
        if (
          !containsPoint(ring, { x: point.x * 0.999 + start.x * 0.001, z: point.z * 0.999 + start.z * 0.001 })
        )
          continue
        matches.push({ point, distance })
      }
      matches.sort((a, b) => a.distance - b.distance)
      if (!matches.length) continue
      const best = matches[0]
      if (
        matches.some(
          (match) =>
            Math.abs(match.distance - best.distance) < 1 &&
            Math.hypot(match.point.x - best.point.x, match.point.z - best.point.z) > 2,
        )
      )
        continue
      points[index] = best.point
      changed = true
    }
    return changed
      ? {
          ...wall,
          points: points.map((point) => ({ x: point.x / width, y: point.z / height })),
          uncertainties: [
            ...wall.uncertainties,
            'Small endpoint overrun joined to a source-supported perpendicular wall; review the junction.',
          ].slice(0, 20),
        }
      : wall
  })
  return { ...proposal, candidates }
}
