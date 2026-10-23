import type { Candidate } from '../../contracts/analysis'
import type { ImageScale } from './candidateChecks'
export function sameWallBand(a: Candidate, b: Candidate, scale?: ImageScale) {
  if (!scale || !a.thickness || !b.thickness || a.points.length !== 2 || b.points.length !== 2) return false
  const pixel = (p: { x: number; y: number }) => ({ x: p.x * scale.width, y: p.y * scale.height })
  const [start, end] = a.points.map(pixel),
    [first, last] = b.points.map(pixel)
  const dx = end.x - start.x,
    dy = end.y - start.y,
    length = Math.hypot(dx, dy),
    ox = last.x - first.x,
    oy = last.y - first.y,
    span = Math.hypot(ox, oy)
  if (!length || !span || Math.abs((dx * ox + dy * oy) / (length * span)) < 0.999) return false
  const across = (p: { x: number; y: number }) =>
    Math.abs((p.x - start.x) * dy - (p.y - start.y) * dx) / length
  const thickness = Math.max(a.thickness, b.thickness) * scale.width
  if (Math.max(across(first), across(last)) > thickness / 2) return false
  const along = (p: { x: number; y: number }) => ((p.x - start.x) * dx + (p.y - start.y) * dy) / length
  const low = Math.min(along(first), along(last)),
    high = Math.max(along(first), along(last))
  return Math.min(length, high) - Math.max(0, low) >= Math.min(length, span) * 0.95
}
export function mergeWallBand(walls: Candidate[], id: string, scale?: ImageScale): Candidate {
  const width = scale?.width || 1,
    height = scale?.height || 1
  const body = walls.toSorted((a, b) => (b.thickness || 0) - (a.thickness || 0))[0]
  const a = body.points[0],
    b = body.points.at(-1)!,
    dx = (b.x - a.x) * width,
    dy = (b.y - a.y) * height,
    length = Math.hypot(dx, dy)
  const offsets = walls.flatMap((w) =>
    w.points.map((p) => ((p.x - a.x) * width * dx + (p.y - a.y) * height * dy) / length),
  )
  const at = (t: number) => ({ x: a.x + ((dx / length) * t) / width, y: a.y + ((dy / length) * t) / height })
  return {
    ...body,
    id,
    points: [at(Math.min(...offsets)), at(Math.max(...offsets))],
    targetId: walls.find((w) => w.targetId)?.targetId,
    uncertainties: [
      ...body.uncertainties,
      'Overlapping source strokes consolidated into one full-span wall band.',
    ].slice(0, 20),
  }
}
