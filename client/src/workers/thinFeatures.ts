import type { Candidate } from './wallScan'
export type ThinFeature = {
  x1: number
  y1: number
  x2: number
  y2: number
  kind: 'axis' | 'diagonal' | 'swing'
}

export function scanThinFeatures(
  fine: Uint8Array,
  structural: Uint8Array,
  width: number,
  height: number,
  walls?: Candidate[],
): ThinFeature[] {
  const found: ThinFeature[] = []
  const directions = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
    [2, 1],
    [2, -1],
    [1, 2],
    [1, -2],
    [3, 1],
    [3, -1],
    [1, 3],
    [1, -3],
  ] as const
  const dark = (x: number, y: number) =>
    x >= 0 && x < width && y >= 0 && y < height && fine[y * width + x] > 0
  const minimum = walls
    ? Math.max(6, Math.round(Math.min(width, height) * 0.009))
    : Math.max(17, Math.round(Math.min(width, height) * 0.035))
  const regions = new Uint8Array(width * height)
  if (walls)
    for (const wall of walls)
      for (const [cx, cy] of [
        [wall.x1, wall.y1],
        [wall.x2, wall.y2],
      ]) {
        const reach = Math.max(12, wall.thicknessPixels * 5, Math.min(width, height) * 0.04)
        for (let y = Math.max(0, Math.floor(cy - reach)); y <= Math.min(height - 1, cy + reach); y++)
          regions.fill(
            1,
            y * width + Math.max(0, Math.floor(cx - reach)),
            y * width + Math.min(width, Math.ceil(cx + reach)),
          )
      }
  for (const [dx, dy] of directions)
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        if ((walls && !regions[y * width + x]) || !dark(x, y) || dark(x - dx, y - dy)) continue
        let length = 0,
          misses = 0,
          hits = 0
        while (length < Math.min(280, Math.min(width, height) * 0.55)) {
          const px = x + length * dx,
            py = y + length * dy
          if (px < 0 || px >= width || py < 0 || py >= height) break
          if (!dark(px, py)) {
            if (++misses > 1) break
          } else {
            misses = 0
            hits++
          }
          length++
        }
        length -= misses
        if (length * Math.hypot(dx, dy) < minimum || hits < length * 0.85) continue
        const midpoint = Math.floor(length / 2),
          px = x + midpoint * dx,
          py = y + midpoint * dy
        const nx = dy === 0 ? 0 : dy > 0 ? 1 : -1,
          ny = dx === 0 ? 0 : -1
        let stroke = 1
        for (const sign of [-1, 1])
          for (let i = 1; i <= 12; i++) {
            if (!dark(px + nx * i * sign, py + ny * i * sign)) break
            stroke++
          }
        if (stroke > Math.max(4, Math.min(width, height) * 0.0035)) continue
        if (structural[py * width + px] && stroke > 3) continue
        const feature: ThinFeature = {
          x1: x,
          y1: y,
          x2: x + (length - 1) * dx,
          y2: y + (length - 1) * dy,
          kind: dy === 0 || dx === 0 ? 'axis' : 'diagonal',
        }
        found.push(feature)
      }
  const result: ThinFeature[] = []
  for (const line of found.sort(
    (a, b) => Math.hypot(b.x2 - b.x1, b.y2 - b.y1) - Math.hypot(a.x2 - a.x1, a.y2 - a.y1),
  )) {
    if (result.length >= (walls ? 6000 : 400)) break
    if (
      result.some((other) => {
        if (
          line.kind !== other.kind ||
          Math.hypot(line.x1 - other.x1, line.y1 - other.y1) >= 5 ||
          Math.hypot(line.x2 - other.x2, line.y2 - other.y2) >= 5
        )
          return false
        if (!walls) return true
        const dx = other.x2 - other.x1,
          dy = other.y2 - other.y1,
          length = Math.hypot(dx, dy)
        return Math.abs((line.x1 - other.x1) * dy - (line.y1 - other.y1) * dx) / length < 1.1
      })
    )
      continue
    result.push(line)
  }
  return result
}
