import type { Door, Passage, Wall, WindowUnit } from '../domain/types'
import { uid } from '../domain/types'
import { atWall, wallLength } from './math'

export function resizeWall(wall: Wall, length: number): Wall {
  if (!Number.isFinite(length) || length < .1) return wall
  const current = wallLength(wall)
  if (current < .0001) return wall
  return { ...wall, end: {
    x: wall.start.x + (wall.end.x - wall.start.x) * length / current,
    z: wall.start.z + (wall.end.z - wall.start.z) * length / current,
  } }
}

export function rotateWall(wall: Wall, degrees: number): Wall {
  if (!Number.isFinite(degrees)) return wall
  const angle = degrees * Math.PI / 180, length = wallLength(wall)
  return { ...wall, end: { x: wall.start.x + Math.cos(angle) * length, z: wall.start.z + Math.sin(angle) * length } }
}

export function wallAngle(wall: Wall) {
  return Math.atan2(wall.end.z - wall.start.z, wall.end.x - wall.start.x) * 180 / Math.PI
}

export function splitPosition(wall: Wall, doors: Door[], windows: WindowUnit[], passages: Passage[] = []): number | null {
  const length = wallLength(wall)
  if (length < .8) return null
  const openings = [...doors, ...windows, ...passages].filter(item => item.wallId === wall.id)
  const candidates = [length / 2, length / 3, length * 2 / 3]
  return candidates.find(offset => offset > .35 && length - offset > .35 &&
    openings.every(item => offset < item.offset - .05 || offset > item.offset + item.width + .05)) ?? null
}

export function splitWall(walls: Wall[], doors: Door[], windows: WindowUnit[], wallId: string, passages: Passage[] = []) {
  const wall = walls.find(item => item.id === wallId)
  const offset = wall && splitPosition(wall, doors, windows, passages)
  if (!wall || offset === null || offset === undefined) return { walls, doors, windows, passages }
  const next: Wall = { ...wall, id: uid('wall'), start: atWall(wall, offset) }
  const first: Wall = { ...wall, end: next.start }
  return {
    walls: walls.flatMap(item => item.id === wallId ? [first, next] : [item]),
    doors: doors.map(item => item.wallId === wallId && item.offset > offset
      ? { ...item, wallId: next.id, offset: item.offset - offset } : item),
    windows: windows.map(item => item.wallId === wallId && item.offset > offset
      ? { ...item, wallId: next.id, offset: item.offset - offset } : item),
    passages: passages.map(item => item.wallId === wallId && item.offset > offset
      ? { ...item, wallId: next.id, offset: item.offset - offset } : item),
  }
}
