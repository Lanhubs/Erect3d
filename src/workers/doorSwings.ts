import type { Candidate } from './wallScan'
import type { ThinFeature } from './thinFeatures'

export function scanDoorSwings(mask: Uint8Array, walls: Candidate[], width: number, height: number): ThinFeature[] {
  const found: ThinFeature[] = []
  const ink = (x: number, y: number, tolerance = 1) => {
    for (let dx = -tolerance; dx <= tolerance; dx++) for (let dy = -tolerance; dy <= tolerance; dy++) {
      const px = Math.round(x) + dx, py = Math.round(y) + dy
      if (px >= 0 && py >= 0 && px < width && py < height && mask[py * width + px]) return true
    }
    return false
  }
  for (const a of walls) for (const b of walls) {
    const horizontal = a.y1 === a.y2
    if (horizontal !== (b.y1 === b.y2)) continue
    const fixed = horizontal ? a.y1 : a.x1, otherFixed = horizontal ? b.y1 : b.x1
    const start = horizontal ? a.x2 : a.y2, end = horizontal ? b.x1 : b.y1, gap = end - start
    if (gap < 5 || gap > Math.max(20, Math.min(width, height) * .075) ||
      Math.abs(fixed - otherFixed) > Math.max(2, (a.thicknessPixels + b.thicknessPixels) / 2)) continue
    if (walls.some(middle => middle !== a && middle !== b && (middle.y1 === middle.y2) === horizontal &&
      Math.abs((horizontal ? middle.y1 : middle.x1) - fixed) < 2 &&
      (horizontal ? middle.x1 : middle.y1) < end - 2 && (horizontal ? middle.x2 : middle.y2) > start + 2)) continue
    for (const atEnd of [false, true]) for (const across of [-1, 1]) {
      const along = atEnd ? -1 : 1, hinge = atEnd ? end : start
      let best: ThinFeature | null = null, bestScore = .78
      for (const fraction of [1, .9, .8, .65, .5]) {
        const radius = gap * fraction
        if (radius < 5) continue
        for (const shift of [0, -a.thicknessPixels / 2, a.thicknessPixels / 2]) {
          const map = (u: number, v: number) => horizontal ? [hinge + u * along, fixed + shift + v * across]
            : [fixed + shift + v * across, hinge + u * along]
          let arc = 0, leaf = 0
          for (let index = 0; index < 15; index++) {
            const angle = (20 + index * 50 / 14) * Math.PI / 180
            const [x, y] = map(radius * Math.cos(angle), radius * Math.sin(angle))
            if (ink(x, y, radius < 12 ? 0 : 1)) arc++
          }
          for (let index = 2; index <= 8; index++) {
            const [x, y] = map(0, radius * index / 8)
            if (ink(x, y)) leaf++
          }
          const score = arc / 15
          if (score <= bestScore || leaf < 5) continue
          bestScore = score
          const [x1, y1] = map(0, 0), [x2, y2] = map(0, radius)
          best = { x1, y1, x2, y2, kind: 'swing' }
        }
      }
      if (best && !found.some(other => Math.hypot(other.x1 - best!.x1, other.y1 - best!.y1) < 4)) found.push(best)
    }
  }
  return found
}
