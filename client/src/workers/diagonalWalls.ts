import type { Candidate } from './wallScan'

export function diagonalWalls(
  lines: Int32Array,
  mask: Uint8Array,
  width: number,
  height: number,
): Candidate[] {
  const found: Candidate[] = [],
    minimum = Math.max(20, Math.min(width, height) * 0.04)
  const black = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height && mask[Math.round(y) * width + Math.round(x)] > 0
  for (let index = 0; index < lines.length; index += 4) {
    let [x1, y1, x2, y2] = Array.from(lines.slice(index, index + 4))
    if (x1 > x2) {
      ;[x1, x2] = [x2, x1]
      ;[y1, y2] = [y2, y1]
    }
    const length = Math.hypot(x2 - x1, y2 - y1),
      ux = (x2 - x1) / length,
      uy = (y2 - y1) / length
    if (length < minimum || Math.min(Math.abs(ux), Math.abs(uy)) < 0.09) continue
    const samples = [0.2, 0.4, 0.6, 0.8]
      .map((t) => {
        const x = x1 + (x2 - x1) * t,
          y = y1 + (y2 - y1) * t
        let low = 0,
          high = 0
        while (low < 20 && black(x + uy * low, y - ux * low)) low++
        while (high < 20 && black(x - uy * high, y + ux * high)) high++
        return { stroke: low + high - 1, shift: (high - low) / 2 }
      })
      .sort((a, b) => a.stroke - b.stroke)
    const thicknessPixels = samples[1].stroke,
      shift = samples[1].shift
    if (thicknessPixels < 3 || length < thicknessPixels * 5) continue
    const candidate = {
      x1: x1 - uy * shift,
      y1: y1 + ux * shift,
      x2: x2 - uy * shift,
      y2: y2 + ux * shift,
      thicknessPixels,
    }
    if (
      found.some((other) => {
        const dx = other.x2 - other.x1,
          dy = other.y2 - other.y1,
          span = Math.hypot(dx, dy)
        const along = ((candidate.x1 - other.x1) * dx) / span + ((candidate.y1 - other.y1) * dy) / span
        return (
          Math.abs((ux * dy) / span - (uy * dx) / span) < 0.04 &&
          Math.abs(((candidate.x1 - other.x1) * dy) / span - ((candidate.y1 - other.y1) * dx) / span) <
            Math.max(2, thicknessPixels) &&
          along < span - minimum / 2 &&
          along + length > minimum / 2
        )
      })
    )
      continue
    found.push(candidate)
  }
  return found
}
