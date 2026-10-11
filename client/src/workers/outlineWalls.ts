import type { Candidate } from './wallScan'
import { filterWallNetwork } from './wallNetwork'

type Edge = { horizontal: boolean; fixed: number; start: number; end: number; stroke: number; last: number }
export function scanWallEdges(mask: Uint8Array, width: number, height: number) {
  const found: Edge[] = [], minimum = Math.max(16, Math.min(width, height) * .03)
  for (const horizontal of [true, false]) {
    const count = horizontal ? height : width, span = horizontal ? width : height
    for (let fixed = 0; fixed < count; fixed++) {
      let start = -1, misses = 0, hits = 0
      for (let along = 0; along <= span; along++) {
        const black = along < span && mask[horizontal ? fixed * width + along : along * width + fixed]
        if (black && start < 0) { start = along; misses = 0; hits = 0 }
        if (start < 0) continue
        if (black) { hits++; misses = 0; continue }
        if (++misses <= 2 && along < span) continue
        const end = along - misses + 1
        if (end - start >= minimum && hits > (end - start) * .8) {
          const prior = found.findLast(edge => edge.horizontal === horizontal && fixed - edge.last === 1 &&
            Math.min(edge.end, end) - Math.max(edge.start, start) > Math.max(edge.end - edge.start, end - start) * .8)
          if (prior) { prior.fixed = (prior.fixed * prior.stroke + fixed) / (prior.stroke + 1); prior.stroke++; prior.last = fixed }
          else found.push({ horizontal, fixed, start, end, stroke: 1, last: fixed })
        }
        start = -1
      }
    }
  }
  return found.filter(edge => edge.stroke <= Math.max(3, Math.min(width, height) * .004))
}

export function outlineWalls(mask: Uint8Array, solid: Candidate[], width: number, height: number) {
  const lines = scanWallEdges(mask, width, height), paired: Candidate[] = []
  const limit = Math.max(12, Math.min(width, height) * .02)
  const bounds = solid.length ? { x1: Math.min(...solid.map(line => Math.min(line.x1, line.x2))), y1: Math.min(...solid.map(line => Math.min(line.y1, line.y2))),
    x2: Math.max(...solid.map(line => Math.max(line.x1, line.x2))), y2: Math.max(...solid.map(line => Math.max(line.y1, line.y2))) } : null
  const pixel = (x: number, y: number) => mask[Math.round(y) * width + Math.round(x)] || 0
  for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
    const a = lines[i], b = lines[j], gap = Math.abs(a.fixed - b.fixed)
    if (a.horizontal !== b.horizontal || gap < (a.stroke + b.stroke) / 2 + 1 || gap > limit) continue
    const start = Math.max(a.start, b.start), end = Math.min(a.end, b.end)
    if (end - start < 16 || end - start < Math.min(a.end - a.start, b.end - b.start) * .7) continue
    // Three or more fine parallel strokes usually describe glazing or hatching.
    if (lines.some((other, index) => index !== i && index !== j && other.horizontal === a.horizontal &&
      other.fixed > Math.min(a.fixed, b.fixed) && other.fixed < Math.max(a.fixed, b.fixed) &&
      Math.min(other.end, end) - Math.max(other.start, start) > (end - start) * .65)) continue
    const cap = (along: number) => {
      let best = 0
      for (let delta = -2; delta <= 2; delta++) {
        let hits = 0
        for (let across = Math.ceil(Math.min(a.fixed, b.fixed)); across <= Math.max(a.fixed, b.fixed); across++)
          hits += a.horizontal ? pixel(along + delta, across) : pixel(across, along + delta)
        best = Math.max(best, hits / gap)
      }
      return best
    }
    const fixed = (a.fixed + b.fixed) / 2
    const continuesWall = solid.some(other => (other.y1 === other.y2) === a.horizontal &&
      Math.abs((a.horizontal ? other.y1 : other.x1) - fixed) < 1.6 &&
      Math.min(Math.abs((a.horizontal ? other.x1 : other.y1) - end), Math.abs((a.horizontal ? other.x2 : other.y2) - start)) < gap * 2)
    if (Math.max(cap(start), cap(end - 1)) < .7 && !continuesWall) continue
    const line = { x1: a.horizontal ? start : fixed, y1: a.horizontal ? fixed : start,
      x2: a.horizontal ? end : fixed, y2: a.horizontal ? fixed : end, thicknessPixels: gap + (a.stroke + b.stroke) / 2 }
    if (bounds) {
      if (a.horizontal && (fixed < bounds.y1 - 3 || fixed > bounds.y2 + 3) ||
        !a.horizontal && (fixed < bounds.x1 - 3 || fixed > bounds.x2 + 3)) continue
      line.x1 = Math.max(line.x1, bounds.x1 - 3); line.y1 = Math.max(line.y1, bounds.y1 - 3)
      line.x2 = Math.min(line.x2, bounds.x2 + 3); line.y2 = Math.min(line.y2, bounds.y2 + 3)
    }
    const existing = solid.find(other => (other.y1 === other.y2) === a.horizontal &&
      Math.abs((a.horizontal ? other.y1 : other.x1) - fixed) < gap / 2 + 1 &&
      Math.min(a.horizontal ? other.x2 : other.y2, end) - Math.max(a.horizontal ? other.x1 : other.y1, start) > (end - start) * .7)
    if (!existing && !paired.some(other => Math.hypot(other.x1 - line.x1, other.y1 - line.y1) < 3 &&
      Math.hypot(other.x2 - line.x2, other.y2 - line.y2) < 3)) paired.push(line)
  }
  return filterWallNetwork([...solid, ...paired], width, height)
}
