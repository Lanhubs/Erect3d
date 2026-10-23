import type { Candidate } from './wallScan'

// Merge overlapping measurements of the same wall body, retaining its outer width.
// Adjacent walls with a visible air gap remain separate.
export function consolidateWalls(input: Candidate[]): Candidate[] {
  const result: Candidate[] = []
  for (const source of input) {
    let line = { ...source },
      merged = true
    while (merged) {
      merged = false
      for (let index = 0; index < result.length; index++) {
        const other = result[index],
          dx = line.x2 - line.x1,
          dy = line.y2 - line.y1,
          length = Math.hypot(dx, dy)
        const ox = other.x2 - other.x1,
          oy = other.y2 - other.y1,
          span = Math.hypot(ox, oy)
        if (!length || !span || (dx * ox + dy * oy) / (length * span) < 0.999) continue
        const ux = dx / length,
          uy = dy / length
        const along = (other.x1 - line.x1) * ux + (other.y1 - line.y1) * uy
        const across = (other.x1 - line.x1) * -uy + (other.y1 - line.y1) * ux
        const overlap = Math.min(length, along + span) - Math.max(0, along)
        if (
          Math.abs(across) > (line.thicknessPixels + other.thicknessPixels) * 0.45 ||
          (overlap < Math.min(length, span) * 0.25 &&
            overlap < -Math.min(2, line.thicknessPixels, other.thicknessPixels))
        )
          continue
        const lo = Math.min(-line.thicknessPixels / 2, across - other.thicknessPixels / 2)
        const hi = Math.max(line.thicknessPixels / 2, across + other.thicknessPixels / 2),
          shift = (lo + hi) / 2
        const start = Math.min(0, along),
          end = Math.max(length, along + span)
        line = {
          x1: line.x1 + ux * start - uy * shift,
          y1: line.y1 + uy * start + ux * shift,
          x2: line.x1 + ux * end - uy * shift,
          y2: line.y1 + uy * end + ux * shift,
          thicknessPixels: hi - lo,
        }
        result.splice(index, 1)
        merged = true
        break
      }
    }
    result.push(line)
  }
  return result
}
