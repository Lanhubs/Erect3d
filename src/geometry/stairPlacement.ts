import type { Level, Point, Room, Slab, Stair } from '../domain/types'
import { atWall } from './math'
import { containsPoint, containsPolygon } from './polygons'
import { buildColliders, collidesPrepared } from './walls'
import { localToWorld, stairLanding, stairOpening, stairSteps } from './stairs'

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z)
const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 })
const roomPriority = (room: Room) => /stair|circulation|concourse|lobby|foyer|entrance|hall|gallery|reception/i
  .test(`${room.category || ''} ${room.name}`) ? 4 : /living|office|retail|community/i.test(`${room.category || ''} ${room.name}`) ? 1 : 0

function overlap(a: Point[], b: Point[]) {
  const orientation = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x)
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) {
    const p = a[i], q = a[(i + 1) % a.length], r = b[j], s = b[(j + 1) % b.length]
    if (orientation(p, q, r) * orientation(p, q, s) < 0 && orientation(r, s, p) * orientation(r, s, q) < 0) return true
  }
  return a.some(point => containsPoint(b, point)) || b.some(point => containsPoint(a, point))
}

function fittingSlab(stair: Stair, levels: Level[], slabs: Slab[]) {
  const opening = stairOpening(stair, levels)
  if (opening.length < 3) return null
  return slabs.find(slab => containsPolygon(slab.polygon, opening) && opening.every((point, index) =>
    containsPoint(slab.polygon, mid(point, opening[(index + 1) % opening.length]))) &&
    !slab.openings.some(existing => existing.id !== stair.openingId && overlap(existing.polygon, opening))) || null
}

export function stairPlacementValid(stair: Stair, levels: Level[], upperSlabs: Slab[]) {
  const from = levels.find(level => level.id === stair.fromLevelId)
  const to = levels.find(level => level.id === stair.toLevelId)
  const steps = stairSteps(stair, levels)
  if (!from || !to || !steps.length || !fittingSlab(stair, levels, upperSlabs)) return false
  const colliders = buildColliders(from.walls, from.doors, from.windows, undefined, from.passages)
  for (const step of steps) {
    const sizeU = step.turn === Math.PI / 2 ? step.width : step.depth
    const sizeV = step.turn === Math.PI / 2 ? step.depth : step.width
    for (const du of [-.45, 0, .45]) for (const dv of [-.45, 0, .45]) {
      const point = localToWorld(stair, step.u + du * sizeU, step.v + dv * sizeV)
      if (collidesPrepared(point, .055, colliders)) return false
    }
  }
  const landing = stairLanding(stair, levels)
  if (landing) for (const du of [-.43, 0, .43]) for (const dv of [-.43, 0, .43]) {
    const point = localToWorld(stair, landing.u + du * landing.sizeU, landing.v + dv * landing.sizeV)
    if (collidesPrepared(point, .055, colliders)) return false
  }
  const upperColliders = buildColliders(to.walls, to.doors, to.windows, undefined, to.passages)
  const last = steps.at(-1)!
  return !collidesPrepared(localToWorld(stair, last.u, last.v), stair.width * .38, upperColliders)
}

function areaBounds(points: Point[]) {
  return { minX: Math.min(...points.map(point => point.x)), maxX: Math.max(...points.map(point => point.x)),
    minZ: Math.min(...points.map(point => point.z)), maxZ: Math.max(...points.map(point => point.z)) }
}

export function findStairPlacement(stair: Stair, levels: Level[], upperSlabs: Slab[], preferred?: Point): Stair | null {
  const from = levels.find(level => level.id === stair.fromLevelId)
  const to = levels.find(level => level.id === stair.toLevelId)
  if (!from || !to || !upperSlabs.length) return null
  const doorPoints = from.doors.flatMap(door => {
    const wall = from.walls.find(item => item.id === door.wallId)
    return wall ? [atWall(wall, door.offset + door.width / 2)] : []
  })
  const rooms = from.rooms.filter(room => room.polygon.length >= 3)
  const areas = rooms.length ? rooms.map(room => room.polygon) : [from.walls.flatMap(wall => [wall.start, wall.end])]
  if (!areas.some(area => area.length >= 3)) return null
  let bestStair: Stair | null = null, bestScore = -Infinity
  const directions = preferred ? [stair.direction, 0, 90, 180, 270] : [0, 90, 180, 270]
  const evaluate = (x: number, z: number) => {
    for (const direction of [...new Set(directions)]) {
      const candidate = { ...stair, start: { x, z }, direction }
      if (!stairPlacementValid(candidate, levels, upperSlabs)) continue
      const first = localToWorld(candidate, 0, 0)
      const sourceRoom = rooms.find(room => containsPoint(room.polygon, first))
      const last = stairSteps(candidate, levels).at(-1)!
      const arrival = localToWorld(candidate, last.u, last.v)
      const arrivalRoom = to.rooms.find(room => containsPoint(room.polygon, arrival))
      const doorDistance = doorPoints.length ? Math.min(...doorPoints.map(point => distance(point, first))) : 5
      const score = (sourceRoom ? roomPriority(sourceRoom) * 8 : -4) +
        (arrivalRoom ? roomPriority(arrivalRoom) * 3 : -4) - Math.abs(doorDistance - 2.5) * .25 -
        (preferred ? distance(candidate.start, preferred) * 2 : 0) -
        (preferred ? Math.abs(((direction - stair.direction + 540) % 360) - 180) / 90 : 0)
      if (score > bestScore) { bestStair = candidate; bestScore = score }
    }
  }
  if (preferred) for (let dx = -10; dx <= 10; dx += .75) for (let dz = -10; dz <= 10; dz += .75)
    evaluate(preferred.x + dx, preferred.z + dz)
  if (!bestStair) for (const area of areas) {
    const box = areaBounds(area)
    const step = Math.max(.75, (box.maxX - box.minX) / 36, (box.maxZ - box.minZ) / 36)
    for (let x = box.minX + .6; x < box.maxX - .6; x += step)
      for (let z = box.minZ + .6; z < box.maxZ - .6; z += step) evaluate(x, z)
  }
  return bestStair
}
