import type { Intelligence, Candidate } from '../contracts/analysis'
import { reconcile } from '../modules/ai/reconcile'
// A vehicle gap on an enclosed GARAGE boundary is not a permanently open
// corridor. The operating style is an editable, explicitly inferred default.
export function completeGarageOpenings(input: Intelligence, width: number, height: number): Intelligence {
  const scale = input.understanding?.scale
  if (!scale) return input
  const pixels = Math.hypot((scale.b.x - scale.a.x) * width, (scale.b.y - scale.a.y) * height),
    metres = scale.knownMetres / pixels
  if (!Number.isFinite(metres) || pixels < 2) return input
  const result = structuredClone(input),
    pixel = (p: { x: number; y: number }) => ({ x: p.x * width, y: p.y * height })
  let changed = false
  for (const opening of result.candidates.filter(
    (c) =>
      c.kind === 'passage' &&
      c.points.length === 2 &&
      /vehicul|vehicle|overhead/i.test(c.id + ' ' + c.evidence + ' ' + (c.label || '')),
  )) {
    const [a, b] = opening.points.map(pixel),
      length = Math.hypot(b.x - a.x, b.y - a.y)
    if (length * metres < 1.8 || length * metres > 8) continue
    let edge: { points: Candidate['points']; thickness: number | undefined } | undefined
    for (const room of result.candidates.filter(
      (c) => c.kind === 'room' && /garage/i.test(c.label || '') && !/carport|open/i.test(c.label || ''),
    )) {
      for (let i = 0; i < room.points.length; i++) {
        const points = [room.points[i], room.points[(i + 1) % room.points.length]],
          p = pixel(points[0]),
          q = pixel(points[1]),
          dx = q.x - p.x,
          dy = q.y - p.y,
          l = Math.hypot(dx, dy)
        if (!l || Math.abs(((b.x - a.x) * dx + (b.y - a.y) * dy) / (length * l)) < 0.995) continue
        const follows = [a, b].every((v) => {
          const t = ((v.x - p.x) * dx + (v.y - p.y) * dy) / (l * l)
          return t >= -0.01 && t <= 1.01 && Math.abs((v.x - p.x) * dy - (v.y - p.y) * dx) / l <= 2.5
        })
        if (follows)
          edge = {
            points,
            thickness: result.candidates.find((c) => c.kind === 'wall' && c.thickness)?.thickness,
          }
      }
    }
    if (!edge) continue
    if (!opening.wallId) {
      const id = (opening.id + '_source_host').slice(0, 160)
      result.candidates.push({
        id,
        kind: 'wall',
        points: edge.points,
        thickness: edge.thickness,
        wallKind: 'exterior',
        origin: 'inferred',
        confidence: opening.confidence,
        needsReview: true,
        evidence:
          'Garage boundary host follows the interpreted enclosed room edge and depicted vehicular gap.',
        uncertainties: ['The continuous host across the opening and its vertical construction are inferred.'],
      })
      opening.wallId = id
    }
    opening.kind = 'door'
    opening.doorStyle = 'sectional'
    opening.origin = 'inferred'
    opening.heightMetres ||= 2.4
    changed = true
    opening.uncertainties = [
      ...opening.uncertainties,
      'Sectional operation and 2.4 m clear height are construction assumptions; verify against the source.',
    ].slice(0, 20)
  }
  // A native fragment may already describe part of this same boundary. Merge its
  // band and retarget every opening, so a second solid cannot cover the door.
  return changed ? reconcile([], [result], 'full', { width, height, metresPerPixel: metres }) : input
}
