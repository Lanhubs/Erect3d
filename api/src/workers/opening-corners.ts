import type { Candidate } from '../contracts/analysis'
export function bridgeCornerOpening(
  opening: Candidate,
  host: Candidate,
  walls: Candidate[],
  width: number,
  height: number,
) {
  if (!['door', 'window'].includes(opening.kind) || host.targetId || host.confidence < 0.7) return false
  const pixel = (point: { x: number; y: number }) => ({ x: point.x * width, z: point.y * height })
  const [a, b] = opening.points.map(pixel),
    dx = b.x - a.x,
    dz = b.z - a.z,
    length = Math.hypot(dx, dz)
  if (length < 3 || (host.thickness || 0) * width > length / 2) return false
  const ux = dx / length,
    uz = dz / length
  const values = host.points.map(pixel).map((point) => (point.x - a.x) * ux + (point.z - a.z) * uz)
  const low = Math.min(...values),
    high = Math.max(...values)
  const tolerance = Math.max(2, ((host.thickness || 0) * width) / 2) + 1
  const missingEnd =
    Math.abs(high) <= tolerance ? length : Math.abs(low - length) <= tolerance ? 0 : undefined
  if (missingEnd === undefined) return false
  let best: { along: number; distance: number } | undefined
  for (const wall of walls) {
    if (
      wall.id === host.id ||
      wall.kind !== 'wall' ||
      wall.curve ||
      wall.points.length !== 2 ||
      wall.confidence < 0.7
    )
      continue
    const [p, q] = wall.points.map(pixel),
      wx = q.x - p.x,
      wz = q.z - p.z,
      span = Math.hypot(wx, wz)
    if (!span || Math.abs((wx * ux + wz * uz) / span) > 0.1 || (wall.thickness || 0) * width > length / 2)
      continue
    const denominator = ux * wz - uz * wx
    const along = ((p.x - a.x) * wz - (p.z - a.z) * wx) / denominator
    const across = ((p.x - a.x) * uz - (p.z - a.z) * ux) / denominator
    const distance = Math.abs(along - missingEnd),
      jamb = Math.max(tolerance, ((wall.thickness || 0) * width) / 2 + 1)
    if (across < 0 || across > 1 || distance > jamb || (best && best.distance <= distance)) continue
    best = { along, distance }
  }
  if (!best) return false
  host.points = [Math.min(low, best.along), Math.max(high, best.along)].map((along) => ({
    x: (a.x + along * ux) / width,
    y: (a.z + along * uz) / height,
  }))
  opening.wallId = host.id
  opening.uncertainties = [
    ...opening.uncertainties,
    'The opening host continues across its gap to an evidenced return wall.',
  ].slice(0, 20)
  return true
}
