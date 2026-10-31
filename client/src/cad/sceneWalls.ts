import type { Door, Level, Wall } from '../domain/types'
import { atWall, distance, wallLength, wallSubpath, wallTangentAngle } from '../geometry/math'
import { wallSolids } from '../geometry/walls'
import { cad, type CadEntity, type CadPoint } from './types'

const degrees = (radians: number) => (radians * 180) / Math.PI
const wrap = (value: number) => ((value % 360) + 360) % 360
const half = (wall: Wall) => wall.thickness / 2

/** Perpendicular to the wall centreline, pointing at one face. */
function faceOffset(wall: Wall, offset: number): CadPoint {
  const angle = wallTangentAngle(wall, offset)
  return { x: -Math.sin(angle) * half(wall), y: Math.cos(angle) * half(wall) }
}

/** A wall band as a closed footprint: the tessellated centreline offset by half its thickness. */
function ribbon(wall: Wall, from: number, to: number, layer: string): CadEntity | null {
  const spine = wallSubpath(wall, from, to)
  if (spine.length < 2 || distance(spine[0], spine[spine.length - 1]) < 0.01) return null
  const left: CadPoint[] = [],
    right: CadPoint[] = []
  spine.forEach((point, index) => {
    const before = spine[Math.max(0, index - 1)],
      after = spine[Math.min(spine.length - 1, index + 1)],
      angle = Math.atan2(after.z - before.z, after.x - before.x),
      nx = -Math.sin(angle) * half(wall),
      nz = Math.cos(angle) * half(wall)
    left.push(cad({ x: point.x + nx, z: point.z + nz }))
    right.push(cad({ x: point.x - nx, z: point.z - nz }))
  })
  return { kind: 'polyline', layer, points: [...left, ...right.reverse()], closed: true }
}

/** The two short lines that close a gap in the wall run. */
function jambs(wall: Wall, from: number, to: number, layer: string): CadEntity[] {
  return [from, to].map((offset) => {
    const at = cad(atWall(wall, offset)),
      face = faceOffset(wall, offset)
    return {
      kind: 'line' as const,
      layer,
      a: { x: at.x - face.x, y: at.y - face.y },
      b: { x: at.x + face.x, y: at.y + face.y },
    }
  })
}

/** Door symbol: leaf at ninety degrees plus the swing arc that sweeps to the closed position. */
function doorLeaf(wall: Wall, door: Door, layer: string): CadEntity[] {
  const length = wallLength(wall),
    hinge = door.hinge === 'left' ? door.offset : door.offset + door.width
  if (!(length > 0 && hinge >= 0 && hinge <= length && door.width > 0)) return []
  const at = cad(atWall(wall, hinge)),
    // Mirroring Z flips the tangent, so the leaf still points along the wall toward its jamb.
    closed = -wallTangentAngle(wall, hinge) + (door.hinge === 'left' ? 0 : Math.PI),
    open = closed + (door.swing === 'out' ? -Math.PI / 2 : Math.PI / 2),
    tip = { x: at.x + Math.cos(open) * door.width, y: at.y + Math.sin(open) * door.width },
    from = wrap(degrees(Math.min(closed, open)))
  return [
    { kind: 'line', layer, a: at, b: tip },
    { kind: 'arc', layer, center: at, radius: door.width, from, to: wrap(from + degrees(Math.PI / 2)) },
  ]
}

type Opening = { wallId: string; offset: number; width: number }

const spanOf = (wall: Wall, opening: Opening) => {
  const from = Math.max(0, opening.offset),
    to = Math.min(wallLength(wall), opening.offset + opening.width)
  return to - from < 0.01 ? null : { from, to }
}

/** A plan is cut at chest height, so door headers above the line stay out of the sheet. */
const planCut = 1.1

/** Walls keep their real material bands, so every door, window and passage stays a cut gap. */
export function wallEntities(level: Level): CadEntity[] {
  const passages = level.passages || [],
    windows = level.windows || [],
    doors = level.doors || [],
    entities: CadEntity[] = []
  for (const wall of level.walls) {
    const solids = wallSolids(wall, doors, windows, passages).filter((solid) => solid.bottom < planCut)
    for (const solid of solids) {
      const footprint = ribbon(wall, solid.start, solid.end, 'A-WALL')
      if (footprint) entities.push(footprint)
    }
    for (const door of doors.filter((item) => item.wallId === wall.id)) {
      const span = spanOf(wall, door)
      if (!span) continue
      entities.push(...jambs(wall, span.from, span.to, 'A-DOOR'), ...doorLeaf(wall, door, 'A-DOOR'))
    }
    for (const window of windows.filter((item) => item.wallId === wall.id)) {
      const span = spanOf(wall, window)
      if (!span) continue
      const frame = ribbon(wall, span.from, span.to, 'A-WINDOW')
      if (frame) entities.push(frame, ...jambs(wall, span.from, span.to, 'A-WINDOW'))
    }
    for (const passage of passages.filter((item) => item.wallId === wall.id)) {
      const span = spanOf(wall, passage)
      if (!span) continue
      entities.push(...jambs(wall, span.from, span.to, 'A-OPENING'))
    }
  }
  return entities
}
