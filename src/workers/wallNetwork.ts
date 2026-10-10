import type { Candidate } from './wallScan'

const length = (line: Candidate) => Math.hypot(line.x2 - line.x1, line.y2 - line.y1)
function endpointGap(a: Candidate, b: Candidate) {
  const dx = b.x2 - b.x1, dy = b.y2 - b.y1, square = dx * dx + dy * dy
  return Math.min(...[[a.x1, a.y1], [a.x2, a.y2]].map(([x, y]) => {
    const t = Math.max(0, Math.min(1, ((x - b.x1) * dx + (y - b.y1) * dy) / Math.max(1, square)))
    return Math.hypot(x - b.x1 - t * dx, y - b.y1 - t * dy)
  }))
}

// Wall junctions support short returns; isolated captions, keys and sheet edges do not.
export function filterWallNetwork(lines: Candidate[], width: number, height: number) {
  const size = Math.min(width, height)
  const inside = lines.filter(line => {
    const horizontal = Math.abs(line.y2 - line.y1) < .1
    const fixed = horizontal ? line.y1 : line.x1, limit = horizontal ? height : width
    const axis = horizontal || Math.abs(line.x2 - line.x1) < .1
    return !(axis && Math.min(fixed, limit - fixed) < Math.max(3, limit * .012) && length(line) > size * .8)
  })
  if (inside.length < 5) return inside
  const neighbours = inside.map(() => [] as number[])
  for (let i = 0; i < inside.length; i++) for (let j = i + 1; j < inside.length; j++) {
    const reach = Math.max(3, Math.min(inside[i].thicknessPixels, inside[j].thicknessPixels) * 1.35)
    if (Math.min(endpointGap(inside[i], inside[j]), endpointGap(inside[j], inside[i])) > reach) continue
    neighbours[i].push(j); neighbours[j].push(i)
  }
  const visited = new Set<number>(), retained = new Set<number>()
  for (let index = 0; index < inside.length; index++) {
    if (visited.has(index)) continue
    const group = [index]; visited.add(index)
    for (let at = 0; at < group.length; at++) for (const next of neighbours[group[at]]) {
      if (!visited.has(next)) { visited.add(next); group.push(next) }
    }
    const total = group.reduce((sum, item) => sum + length(inside[item]), 0)
    const substantial = group.some(item => length(inside[item]) > size * .1 && length(inside[item]) / inside[item].thicknessPixels > 7)
    if (group.length >= 2 && total > size * .14 && substantial ||
      group.length < 3 && group.some(item => length(inside[item]) > size * .22 && length(inside[item]) / inside[item].thicknessPixels > 12))
      group.forEach(item => retained.add(item))
  }
  for (let pass = 0; pass < 2; pass++) for (let index = 0; index < inside.length; index++) {
    if (retained.has(index)) continue
    const a = inside[index], horizontal = a.y1 === a.y2
    if (length(a) < a.thicknessPixels * 3) continue
    if ([...retained].some(other => {
      const b = inside[other]
      return horizontal === (b.y1 === b.y2) && Math.abs((horizontal ? a.y1 - b.y1 : a.x1 - b.x1)) < 2 &&
        Math.min(endpointGap(a, b), endpointGap(b, a)) < size * .15
    })) retained.add(index)
  }
  return inside.filter((_, index) => retained.has(index))
}
