import type { Candidate } from './wallScan'
import type { ThinFeature } from './thinFeatures'
import { stairTreads } from './stairTreads'

export type PixelDetail = { kind: 'column' | 'stair'; polygon: Array<{ x: number; z: number }>; confidence: number; evidence: string; treadCount?: number }
const rectangle = (x1: number, z1: number, x2: number, z2: number) => [{ x: x1, z: z1 }, { x: x2, z: z1 }, { x: x2, z: z2 }, { x: x1, z: z2 }]

export function scanPlanDetails(mask: Uint8Array, walls: Candidate[], width: number, height: number): PixelDetail[] {
  const details: PixelDetail[] = [], size = Math.min(width, height)
  const features: ThinFeature[] = stairTreads(mask, width, height)
  const black = (x: number, y: number) => mask[Math.round(y) * width + Math.round(x)] || 0
  for (const horizontal of [true, false]) {
    const lines = features.filter(line => line.kind === 'axis' && (Math.abs(line.y2 - line.y1) < .1) === horizontal)
      .map(line => ({ fixed: horizontal ? line.y1 : line.x1, start: horizontal ? line.x1 : line.y1, end: horizontal ? line.x2 : line.y2 }))
      .filter(line => line.end - line.start >= 8 && line.end - line.start <= size * .13).sort((a, b) => a.fixed - b.fixed)
    const used = new Set<number>()
    lines.forEach((seed, index) => {
      if (used.has(index)) return
      const group = [index]
      for (let next = index + 1; next < lines.length; next++) {
        const line = lines[next], prior = lines[group.at(-1)!]
        if (line.fixed - prior.fixed > Math.max(8, size * .015)) break
        if (line.fixed - prior.fixed < 1.5 || Math.abs(seed.start - line.start) > 3 || Math.abs(seed.end - line.end) > 3) continue
        group.push(next)
      }
      if (group.length < 5) return
      const gaps = group.slice(1).map((item, at) => lines[item].fixed - lines[group[at]].fixed).sort((a, b) => a - b)
      const spacing = gaps[Math.floor(gaps.length / 2)]
      if (gaps.some(gap => Math.abs(gap - spacing) > spacing * .4)) return
      const first = lines[group[0]].fixed, last = lines[group.at(-1)!].fixed
      const rail = (along: number) => {
        let hits = 0
        for (let at = Math.ceil(first); at <= last; at++)
          if ([-1, 0, 1].some(delta => horizontal ? black(along + delta, at) : black(at, along + delta))) hits++
        return hits / Math.max(1, last - first)
      }
      if (rail(seed.start) < .7 || rail(seed.end) < .7 || last - first < (seed.end - seed.start) * .6) return
      const polygon = horizontal ? rectangle(seed.start, first - spacing / 2, seed.end, last + spacing / 2)
        : rectangle(first - spacing / 2, seed.start, last + spacing / 2, seed.end)
      details.push({ kind: 'stair', polygon, confidence: .82, evidence: `${group.length} regularly spaced treads between side rails; direction and storey need review`, treadCount: group.length })
      group.forEach(item => used.add(item))
    })
  }
  const visited = new Uint8Array(mask.length), queue = new Int32Array(mask.length)
  for (let index = 0; index < mask.length; index++) {
    if (!mask[index] || visited[index]) continue
    let count = 1, head = 0, minX = index % width, maxX = minX, minY = Math.floor(index / width), maxY = minY
    queue[0] = index; visited[index] = 1
    while (head < count) {
      const current = queue[head++], x = current % width, y = Math.floor(current / width)
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y)
      for (const next of [x > 0 ? current - 1 : -1, x < width - 1 ? current + 1 : -1, y > 0 ? current - width : -1, y < height - 1 ? current + width : -1])
        if (next >= 0 && mask[next] && !visited[next]) { visited[next] = 1; queue[count++] = next }
    }
    const w = maxX - minX + 1, h = maxY - minY + 1
    if (Math.min(w, h) < 4 || Math.max(w, h) > Math.max(12, size * .025) || w / h < .8 || w / h > 1.25 || count / (w * h) < .88) continue
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
    const nearWall = walls.some(wall => {
      const dx = wall.x2 - wall.x1, dy = wall.y2 - wall.y1, length = dx * dx + dy * dy
      const t = Math.max(0, Math.min(1, ((cx - wall.x1) * dx + (cy - wall.y1) * dy) / Math.max(1, length)))
      return Math.hypot(cx - wall.x1 - dx * t, cy - wall.y1 - dy * t) < Math.max(w, h) * 2
    })
    details.push({ kind: 'column', polygon: rectangle(minX, minY, maxX + 1, maxY + 1), confidence: nearWall ? .75 : .55,
      evidence: nearWall ? 'Compact solid square near the wall network' : 'Isolated square mark; confirm that it is a structural column' })
  }
  return details.filter((detail, index) => !details.slice(0, index).some(other => other.kind === detail.kind &&
    Math.hypot(other.polygon[0].x - detail.polygon[0].x, other.polygon[0].z - detail.polygon[0].z) < 5))
}
