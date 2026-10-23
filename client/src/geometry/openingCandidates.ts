import { openingEvidence } from './openingEvidence'
import { advance, dot, subtract, wallLine } from './planLines'
import type { Point, Wall } from '../domain/types'
export type WorldFeature = { start: Point; end: Point; kind: 'axis' | 'diagonal' | 'swing' }

export type OpeningChoice = 'unknown' | 'wall' | 'door' | 'window' | 'passage'
export type OpeningCandidate = {
  id: string
  firstId: string
  secondId: string
  start: Point
  end: Point
  width: number
  exterior: boolean
  choice: OpeningChoice
  confidence?: number
  evidence?: string
  hinge?: 'left' | 'right'
  doubleLeaf?: boolean
}
type Axis = { horizontal: boolean; fixed: number; start: number; end: number }
export function wallAxis(wall: Wall): Axis | null {
  const dx = wall.end.x - wall.start.x,
    dz = wall.end.z - wall.start.z
  if (Math.abs(dx) > 0.35 && Math.abs(dz) < 0.12)
    return {
      horizontal: true,
      fixed: (wall.start.z + wall.end.z) / 2,
      start: Math.min(wall.start.x, wall.end.x),
      end: Math.max(wall.start.x, wall.end.x),
    }
  if (Math.abs(dz) > 0.35 && Math.abs(dx) < 0.12)
    return {
      horizontal: false,
      fixed: (wall.start.x + wall.end.x) / 2,
      start: Math.min(wall.start.z, wall.end.z),
      end: Math.max(wall.start.z, wall.end.z),
    }
  return null
}
export function findOpeningCandidates(walls: Wall[], features: WorldFeature[] = []): OpeningCandidate[] {
  const axes = walls.map(wallLine)
  const coordinates = walls.flatMap((wall) => [wall.start, wall.end])
  if (!coordinates.length) return []
  const minX = Math.min(...coordinates.map((point) => point.x)),
    maxX = Math.max(...coordinates.map((point) => point.x))
  const minZ = Math.min(...coordinates.map((point) => point.z)),
    maxZ = Math.max(...coordinates.map((point) => point.z))
  const edgeX = Math.max(0.35, (maxX - minX) * 0.12),
    edgeZ = Math.max(0.35, (maxZ - minZ) * 0.12)
  const proposals: OpeningCandidate[] = []
  for (let i = 0; i < walls.length; i++)
    for (let j = 0; j < walls.length; j++) {
      if (i === j) continue
      const a = axes[i],
        b = axes[j]
      if (!a || !b || dot(a.unit, b.unit) < 0.998) continue
      const delta = subtract(b.start, a.start),
        across = Math.abs(delta.x * a.unit.z - delta.z * a.unit.x)
      if (across > Math.max(0.16, (walls[i].thickness + walls[j].thickness) / 2)) continue
      const nextStart = dot(delta, a.unit),
        gap = nextStart - a.length
      const seam =
        gap > 0.02 && gap < 0.3 && gap <= Math.max(0.15, (walls[i].thickness + walls[j].thickness) * 0.65)
      if (!seam && (gap < 0.3 || gap > 3)) continue
      if (
        axes.some((middle, index) => {
          if (index === i || index === j || !middle || dot(a.unit, middle.unit) < 0.998) return false
          const shift = subtract(middle.start, a.start),
            begin = dot(shift, a.unit)
          return (
            Math.abs(shift.x * a.unit.z - shift.z * a.unit.x) < 0.16 &&
            begin < nextStart - 0.05 &&
            begin + middle.length > a.length + 0.05
          )
        })
      )
        continue
      const center = advance(a.end, a.unit, gap / 2)
      const exterior =
        Math.min(Math.abs(center.x - minX), Math.abs(center.x - maxX)) < edgeX ||
        Math.min(Math.abs(center.z - minZ), Math.abs(center.z - maxZ)) < edgeZ
      const candidate: OpeningCandidate = {
        id: `${walls[i].id}:${walls[j].id}`,
        firstId: walls[i].id,
        secondId: walls[j].id,
        start: a.end,
        end: advance(a.end, a.unit, gap),
        width: gap,
        exterior,
        choice: 'unknown',
      }
      Object.assign(
        candidate,
        seam
          ? { choice: 'wall', confidence: 0.8, evidence: 'Small seam between aligned wall strokes' }
          : openingEvidence(candidate, features),
      )
      proposals.push(candidate)
    }
  return proposals.sort((a, b) => a.start.x - b.start.x || a.start.z - b.start.z).slice(0, 1000)
}
