import type { Intelligence, Candidate } from '../contracts/analysis'
// Native wall bands stop at a real opening. Reconnect two flanking, collinear
// fragments only when the interpreted gap is anchored to both of their ends.
export function bridgeOpeningHosts(input: Intelligence, width: number, height: number): Intelligence {
  const proposal = structuredClone(input),
    aliases = new Map<string, string>(),
    removed = new Set<string>()
  const pixel = (p: { x: number; y: number }) => ({ x: p.x * width, y: p.y * height })
  for (const opening of proposal.candidates.filter(
    (c) => ['door', 'window', 'passage'].includes(c.kind) && c.points.length === 2,
  )) {
    const [a, b] = opening.points.map(pixel),
      dx = b.x - a.x,
      dy = b.y - a.y,
      length = Math.hypot(dx, dy)
    if (length < 2) continue
    const ux = dx / length,
      uy = dy / length
    const bands = proposal.candidates
      .filter((c) => c.kind === 'wall' && !c.curve && c.points.length === 2 && !removed.has(c.id))
      .flatMap((w) => {
        const [p, q] = w.points.map(pixel),
          wx = q.x - p.x,
          wy = q.y - p.y,
          wl = Math.hypot(wx, wy),
          tolerance = Math.max(2, ((w.thickness || 0) * width) / 2)
        if (!wl || Math.abs((wx * ux + wy * uy) / wl) < 0.995) return []
        const dist = Math.max(
          Math.abs((p.x - a.x) * uy - (p.y - a.y) * ux),
          Math.abs((q.x - a.x) * uy - (q.y - a.y) * ux),
        )
        if (dist > tolerance) return []
        const offsets = [(p.x - a.x) * ux + (p.y - a.y) * uy, (q.x - a.x) * ux + (q.y - a.y) * uy].sort(
          (x, y) => x - y,
        )
        return [{ wall: w, min: offsets[0], max: offsets[1], tolerance }]
      })
    if (bands.some((w) => w.min <= 1 && w.max >= length - 1)) continue
    const before = bands
      .filter((w) => w.min < -1 && Math.abs(w.max) < w.tolerance + 1)
      .sort((p, q) => Math.abs(p.max) - Math.abs(q.max))[0]
    const after = bands
      .filter((w) => w.max > length + 1 && Math.abs(w.min - length) < w.tolerance + 1)
      .sort((p, q) => Math.abs(p.min - length) - Math.abs(q.min - length))[0]
    if (!before || !after || before.wall.id === after.wall.id) continue
    const host: Candidate = opening.wallId === after.wall.id ? after.wall : before.wall,
      other = host === before.wall ? after.wall : before.wall
    host.points = [before.min, after.max].map((t) => ({
      x: (a.x + ux * t) / width,
      y: (a.y + uy * t) / height,
    }))
    host.thickness = Math.max(before.wall.thickness || 0, after.wall.thickness || 0) || undefined
    removed.add(other.id)
    aliases.set(other.id, host.id)
    opening.wallId = host.id
  }
  const resolve = (id: string) => {
    const seen = new Set<string>()
    while (aliases.has(id) && !seen.has(id)) {
      seen.add(id)
      id = aliases.get(id)!
    }
    return id
  }
  proposal.candidates = proposal.candidates
    .filter((c) => !removed.has(c.id))
    .map((c) => (c.wallId ? { ...c, wallId: resolve(c.wallId) } : c))
  return proposal
}
