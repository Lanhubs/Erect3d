import type { Level, Point, Selection } from '../domain/types'
import { verandaGeometry, verandaCover } from '../geometry/veranda'
import { localToWorld, stairSteps, stairLanding, stairExitLanding } from '../geometry/stairs'
import { roofLayout, type Vertex } from '../geometry/roof'

export type SoftwareFace = { key: string; vertices: Vertex[]; fill: string; stroke?: string; depth: number; select?: Selection }
export function softwareDetails(level: Level, levels: Level[], roofShown: boolean): SoftwareFace[] {
  const faces: SoftwareFace[] = []
  const add = (key: string, polygon: Vertex[], fill: string, select: Selection, depth?: number) => faces.push({ key, vertices: polygon, fill,
    select, stroke: '#68756e', depth: depth ?? polygon.reduce((sum, [x, , z]) => sum + x + z, 0) / polygon.length + .02 })
  const box = (id: string, center: Point, length: number, width: number, base: number, height: number, angle: number, fill: string, selection: Selection) => {
    const at = (u: number, v: number): Point => ({ x: center.x + u * Math.cos(angle) - v * Math.sin(angle), z: center.z + u * Math.sin(angle) + v * Math.cos(angle) })
    const ring = [at(-length / 2, -width / 2), at(length / 2, -width / 2), at(length / 2, width / 2), at(-length / 2, width / 2)]
    add(`${id}:top`, ring.map(p => [p.x, base + height, p.z]), fill, selection)
    ring.forEach((p, i) => { const q = ring[(i + 1) % ring.length]
      add(`${id}:side${i}`, [[p.x, base, p.z], [q.x, base, q.z], [q.x, base + height, q.z], [p.x, base + height, p.z]], fill, selection) })
  }
  for (const room of level.rooms) add(room.id, room.polygon.map(p => [p.x, .01, p.z]), '#dbd8c9', { kind: 'room', id: room.id }, -999)
  for (const column of level.columns || []) box(column.id, column.position, column.shape === 'circular' ? column.diameter : column.width,
    column.shape === 'circular' ? column.diameter : column.depth, 0, column.height, (column.rotation || 0) * Math.PI / 180, '#a7b0a9', { kind: 'column', id: column.id })
  for (const stair of level.stairs || []) stairSteps(stair, levels).forEach((step, i) => box(`${stair.id}:${i}`, localToWorld(stair, step.u, step.v),
    step.depth, step.width, 0, step.height, stair.direction * Math.PI / 180 + step.turn, '#b9b6aa', { kind: 'stair', id: stair.id }))
  for (const stair of level.stairs || []) [stairLanding(stair, levels), stairExitLanding(stair, levels)].forEach((landing, i) => {
    if (landing) box(`${stair.id}:landing${i}`, localToWorld(stair, landing.u, landing.v), landing.sizeU, landing.sizeV, landing.height - .18, .18, stair.direction * Math.PI / 180, '#b9b6aa', { kind: 'stair', id: stair.id })
  })
  for (const ramp of level.ramps || []) {
    const dx = ramp.end.x - ramp.start.x, dz = ramp.end.z - ramp.start.z, length = Math.hypot(dx, dz) || 1
    const at = (p: Point, side: number, height: number): Vertex => [p.x - dz / length * ramp.width / 2 * side, height, p.z + dx / length * ramp.width / 2 * side]
    add(ramp.id, [at(ramp.start, -1, ramp.startElevation), at(ramp.end, -1, ramp.endElevation), at(ramp.end, 1, ramp.endElevation), at(ramp.start, 1, ramp.startElevation)], '#bab5aa', { kind: 'ramp', id: ramp.id })
  }
  for (const detail of level.details || []) box(detail.id, { x: (detail.start.x + detail.end.x) / 2, z: (detail.start.z + detail.end.z) / 2 },
    Math.hypot(detail.end.x - detail.start.x, detail.end.z - detail.start.z), detail.depth, detail.baseElevation, detail.height,
    Math.atan2(detail.end.z - detail.start.z, detail.end.x - detail.start.x), detail.color || '#80918b', { kind: 'detail', id: detail.id })
  for (const section of level.seatingSections || []) {
    const dx = section.end.x - section.start.x, dz = section.end.z - section.start.z, length = Math.hypot(dx, dz) || 1
    const center = { x: (section.start.x + section.end.x) / 2, z: (section.start.z + section.end.z) / 2 }
    const sign = (-dz * (section.outward.x - center.x) + dx * (section.outward.z - center.z)) >= 0 ? 1 : -1
    for (let row = 0; row < section.rows; row++) box(`${section.id}:${row}`, { x: center.x - dz / length * sign * (row + .5) * section.rowDepth,
      z: center.z + dx / length * sign * (row + .5) * section.rowDepth }, length, section.rowDepth,
      section.baseElevation, (row + 1) * section.rowRise, Math.atan2(dz, dx), section.seatColor, { kind: 'seating', id: section.id })
  }
  for (const door of level.doors) {
    const veranda = verandaGeometry(level, door), cover = verandaCover(level, door)
    if (!veranda || !door.veranda) continue
    if (door.veranda.railing) veranda.rails.forEach(([p, q], i) => add(`${door.id}:rail${i}`,
      [[p.x, 0, p.z], [q.x, 0, q.z], [q.x, 1.1, q.z], [p.x, 1.1, p.z]], '#8b9a9e', { kind: 'door', id: door.id }))
    if (cover && roofShown) roofLayout(cover.bounds, cover.roof).faces.forEach((face, i) => add(`${door.id}:cover${i}`, face.map(([x, y, z]) => [
      veranda.anchor.x + x * Math.cos(veranda.angle) - z * Math.sin(veranda.angle), y,
      veranda.anchor.z + x * Math.sin(veranda.angle) + z * Math.cos(veranda.angle)]), cover.roof.color, { kind: 'door', id: door.id }, 998))
  }
  return faces
}
