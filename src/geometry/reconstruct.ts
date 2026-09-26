import type { Door, Passage, Wall, WindowUnit } from '../domain/types'
import { uid } from '../domain/types'
import type { OpeningCandidate } from './openingCandidates'
import { wallAxis } from './openingCandidates'

type Draft = { walls: Wall[]; doors: Door[]; windows: WindowUnit[]; passages: Passage[] }

export function assembleDraft(detected: Wall[], proposals: OpeningCandidate[] = []): Draft {
  const walls = detected.map(wall => {
    const line = wallAxis(wall)
    if (!line) return wall
    return { ...wall, start: line.horizontal ? { x: line.start, z: line.fixed } : { x: line.fixed, z: line.start },
      end: line.horizontal ? { x: line.end, z: line.fixed } : { x: line.fixed, z: line.end } }
  })
  const doors: Door[] = [], windows: WindowUnit[] = [], passages: Passage[] = []
  const owner = new Map(walls.map(wall => [wall.id, wall.id]))
  for (const proposal of proposals) {
    if (proposal.choice === 'unknown') continue
    const firstId = owner.get(proposal.firstId), secondId = owner.get(proposal.secondId)
    const first = walls.findIndex(wall => wall.id === firstId), second = walls.findIndex(wall => wall.id === secondId)
    if (first < 0 || second < 0 || first === second) continue
    const a = walls[first], b = walls[second], left = wallAxis(a), right = wallAxis(b)
    if (!left || !right || left.horizontal !== right.horizontal || Math.abs(left.fixed - right.fixed) > .2) continue
    const offset = left.end - left.start, gap = right.start - left.end
    if (gap < .35 || Math.abs(gap - proposal.width) > .2) continue
    const shift = offset + gap
    for (const item of [...doors, ...windows, ...passages]) if (item.wallId === b.id) { item.wallId = a.id; item.offset += shift }
    walls[first] = { ...a, end: left.horizontal ? { x: right.end, z: left.fixed } : { x: left.fixed, z: right.end },
      thickness: Math.max(a.thickness, b.thickness) }
    walls.splice(second, 1)
    for (const [id, current] of owner) if (current === b.id) owner.set(id, a.id)
    if (proposal.choice === 'door') doors.push({ id: uid('door'), wallId: a.id, offset, width: gap, height: 2.1, hinge: 'left' })
    if (proposal.choice === 'window') windows.push({ id: uid('window'), wallId: a.id, offset, width: gap, height: 1.25, sill: .85 })
    if (proposal.choice === 'passage') passages.push({ id: uid('passage'), wallId: a.id, offset, width: gap, height: 2.2 })
  }
  return { walls, doors, windows, passages }
}
