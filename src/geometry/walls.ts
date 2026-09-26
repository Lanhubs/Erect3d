import type { Door, Passage, Point, Wall, WindowUnit } from '../domain/types'
import { atWall, wallLength } from './math'

export type Solid = { start: number; end: number; bottom: number; top: number }
export type Collider = { a: Point; b: Point; halfWidth: number }
type Opening = { start: number; end: number; bottom: number; top: number }

export function wallSolids(wall: Wall, doors: Door[], windows: WindowUnit[], passages: Passage[] = []): Solid[] {
  const length = wallLength(wall)
  const openings: Opening[] = [
    ...doors.filter(item => item.wallId === wall.id).map(item => ({ start: item.offset, end: item.offset + item.width, bottom: 0, top: item.height })),
    ...windows.filter(item => item.wallId === wall.id).map(item => ({ start: item.offset, end: item.offset + item.width, bottom: item.sill, top: item.sill + item.height })),
    ...passages.filter(item => item.wallId === wall.id).map(item => ({ start: item.offset, end: item.offset + item.width, bottom: 0, top: item.height })),
  ].filter(item => item.end > 0 && item.start < length)
  const cuts = [...new Set([0, length, ...openings.flatMap(item => [Math.max(0, item.start), Math.min(length, item.end)])])].sort((a, b) => a - b)
  const solids: Solid[] = []
  for (let i = 0; i < cuts.length - 1; i++) {
    const start = cuts[i], end = cuts[i + 1]
    if (end - start < .001) continue
    const opening = openings.find(item => item.start < end - .001 && item.end > start + .001)
    if (!opening) solids.push({ start, end, bottom: 0, top: wall.height })
    else {
      if (opening.bottom > .001) solids.push({ start, end, bottom: 0, top: opening.bottom })
      if (opening.top < wall.height - .001) solids.push({ start, end, bottom: opening.top, top: wall.height })
    }
  }
  return solids
}
export function wallRect(wall: Wall, solid: Solid) {
  const a = atWall(wall, solid.start), b = atWall(wall, solid.end)
  return { center: [(a.x + b.x) / 2, (solid.bottom + solid.top) / 2, (a.z + b.z) / 2] as [number, number, number],
    size: [solid.end - solid.start + .005, solid.top - solid.bottom, wall.thickness] as [number, number, number],
    rotation: -Math.atan2(b.z - a.z, b.x - a.x) }
}
export function buildColliders(walls: Wall[], doors: Door[], windows: WindowUnit[], openDoors?: ReadonlySet<string>, passages: Passage[] = []): Collider[] {
  const structure = walls.flatMap(wall => wallSolids(wall, doors, windows, passages)
    .filter(solid => solid.bottom < 1.1)
    .map(solid => ({ a: atWall(wall, solid.start), b: atWall(wall, solid.end), halfWidth: wall.thickness / 2 })))
  if (!openDoors) return structure
  const leaves = doors.filter(door => !openDoors.has(door.id)).flatMap(door => {
    const wall = walls.find(item => item.id === door.wallId)
    return wall ? [{ a: atWall(wall, door.offset), b: atWall(wall, door.offset + door.width), halfWidth: .04 }] : []
  })
  return [...structure, ...leaves]
}
export function collidesPrepared(point: Point, radius: number, colliders: Collider[]): boolean {
  return colliders.some(({ a, b, halfWidth }) => {
    const dx = b.x - a.x, dz = b.z - a.z
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / Math.max(dx * dx + dz * dz, .00001)))
    return Math.hypot(point.x - a.x - t * dx, point.z - a.z - t * dz) < radius + halfWidth
  })
}
export const collides = (point: Point, radius: number, walls: Wall[], doors: Door[], windows: WindowUnit[], passages: Passage[] = []) =>
  collidesPrepared(point, radius, buildColliders(walls, doors, windows, undefined, passages))
