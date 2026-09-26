import type { Point, Wall } from '../domain/types'
export type WorldFeature = { start: Point; end: Point; kind: 'axis' | 'diagonal' }

export type OpeningChoice = 'unknown' | 'wall' | 'door' | 'window' | 'passage'
export type OpeningCandidate = { id: string; firstId: string; secondId: string; start: Point; end: Point; width: number;
  exterior: boolean; choice: OpeningChoice }
type Axis = { horizontal: boolean; fixed: number; start: number; end: number }
export function wallAxis(wall: Wall): Axis | null {
  const dx = wall.end.x - wall.start.x, dz = wall.end.z - wall.start.z
  if (Math.abs(dx) > .35 && Math.abs(dz) < .12)
    return { horizontal: true, fixed: (wall.start.z + wall.end.z) / 2, start: Math.min(wall.start.x, wall.end.x), end: Math.max(wall.start.x, wall.end.x) }
  if (Math.abs(dz) > .35 && Math.abs(dx) < .12)
    return { horizontal: false, fixed: (wall.start.x + wall.end.x) / 2, start: Math.min(wall.start.z, wall.end.z), end: Math.max(wall.start.z, wall.end.z) }
  return null
}
function evidence(choice: OpeningCandidate, features: WorldFeature[]): OpeningChoice {
  const horizontal = Math.abs(choice.start.z - choice.end.z) < .01
  const lo = horizontal ? choice.start.x : choice.start.z
  const hi = horizontal ? choice.end.x : choice.end.z
  const fixed = horizontal ? choice.start.z : choice.start.x
  const aligned = features.filter(line => {
    const a = horizontal ? line.start.x : line.start.z, b = horizontal ? line.end.x : line.end.z
    const crossA = horizontal ? line.start.z : line.start.x, crossB = horizontal ? line.end.z : line.end.x
    return Math.max(a, b) > lo + choice.width * .2 && Math.min(a, b) < hi - choice.width * .2 &&
      Math.min(Math.abs(crossA - fixed), Math.abs(crossB - fixed)) < .35
  })
  const diagonal = aligned.some(line => line.kind === 'diagonal' &&
    Math.hypot(line.end.x - line.start.x, line.end.z - line.start.z) > Math.min(.35, choice.width * .4) &&
    [line.start, line.end].some(point => {
      const along = horizontal ? point.x : point.z
      return Math.abs(along - lo) < .3 || Math.abs(along - hi) < .3
    }))
  if (diagonal) return 'door'
  const windowLines = aligned.filter(line => line.kind === 'axis' &&
    (horizontal ? Math.abs(line.end.z - line.start.z) < .08 : Math.abs(line.end.x - line.start.x) < .08) &&
    Math.abs((horizontal ? line.start.z : line.start.x) - fixed) < .24 &&
    Math.abs(horizontal ? line.end.x - line.start.x : line.end.z - line.start.z) > choice.width * .55)
  return windowLines.length >= 2 ? 'window' : 'unknown'
}
export function findOpeningCandidates(walls: Wall[], features: WorldFeature[] = []): OpeningCandidate[] {
  const axes = walls.map(wallAxis)
  const coordinates = walls.flatMap(wall => [wall.start, wall.end])
  if (!coordinates.length) return []
  const minX = Math.min(...coordinates.map(point => point.x)), maxX = Math.max(...coordinates.map(point => point.x))
  const minZ = Math.min(...coordinates.map(point => point.z)), maxZ = Math.max(...coordinates.map(point => point.z))
  const proposals: OpeningCandidate[] = []
  for (let i = 0; i < walls.length; i++) for (let j = 0; j < walls.length; j++) {
    if (i === j) continue
    const a = axes[i], b = axes[j]
    if (!a || !b || a.horizontal !== b.horizontal || Math.abs(a.fixed - b.fixed) > Math.max(.16, (walls[i].thickness + walls[j].thickness) / 2)) continue
    const gap = b.start - a.end
    if (gap < .4 || gap > 3) continue
    const fixed = (a.fixed + b.fixed) / 2
    const exterior = a.horizontal ? Math.min(Math.abs(fixed - minZ), Math.abs(fixed - maxZ)) < .35
      : Math.min(Math.abs(fixed - minX), Math.abs(fixed - maxX)) < .35
    const candidate: OpeningCandidate = { id: `${walls[i].id}:${walls[j].id}`, firstId: walls[i].id, secondId: walls[j].id,
      start: a.horizontal ? { x: a.end, z: fixed } : { x: fixed, z: a.end },
      end: a.horizontal ? { x: b.start, z: fixed } : { x: fixed, z: b.start }, width: gap, exterior, choice: 'unknown' }
    candidate.choice = evidence(candidate, features)
    proposals.push(candidate)
  }
  return proposals.sort((a, b) => a.start.x - b.start.x || a.start.z - b.start.z).slice(0, 80)
}
