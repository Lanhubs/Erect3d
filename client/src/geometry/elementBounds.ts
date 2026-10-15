import type { Level, Point } from '../domain/types'
import { wallBoundsPoints } from './math'
import { stairOpening } from './stairs'
import { verandaGeometry } from './veranda'
import { furnitureFootprint } from '../furniture/entities'

export function levelBoundsPoints(level: Level, levels?: Level[]): Point[] {
  const points = [...wallBoundsPoints(level.walls), ...level.rooms.flatMap(room => room.polygon), ...(level.slabs || []).flatMap(slab => slab.polygon)]
  for (const column of level.columns || []) {
    const radius = column.shape === 'circular' ? column.diameter / 2 : Math.hypot(column.width, column.depth) / 2
    points.push({ x: column.position.x - radius, z: column.position.z - radius }, { x: column.position.x + radius, z: column.position.z + radius })
  }
  for (const stair of level.stairs || []) points.push(...(levels ? stairOpening(stair, levels) : [stair.start]))
  for (const ramp of level.ramps || []) for (const p of [ramp.start, ramp.end]) points.push({ x: p.x - ramp.width / 2, z: p.z - ramp.width / 2 }, { x: p.x + ramp.width / 2, z: p.z + ramp.width / 2 })
  for (const detail of level.details || []) {
    const dx = detail.end.x - detail.start.x, dz = detail.end.z - detail.start.z, length = Math.hypot(dx, dz) || 1
    points.push(detail.start, detail.end, ...[detail.start, detail.end].map(p => ({ x: p.x - dz / length * detail.depth, z: p.z + dx / length * detail.depth })))
  }
  for (const section of level.seatingSections || []) {
    const dx = section.end.x - section.start.x, dz = section.end.z - section.start.z, length = Math.hypot(dx, dz) || 1
    const outwardLength=Math.hypot(section.outward.x,section.outward.z)||1,growth=(section.rowWidthGrowth||0)*(section.rows-1)/2
    points.push(section.start,section.end,...[section.start,section.end].map((p,index)=>({x:p.x+section.outward.x/outwardLength*section.rows*section.rowDepth+dx/length*growth*(index?1:-1),z:p.z+section.outward.z/outwardLength*section.rows*section.rowDepth+dz/length*growth*(index?1:-1)})))
  }
  for (const door of level.doors) points.push(...(verandaGeometry(level, door)?.polygon || []))
  points.push(...(level.furniture || []).flatMap(furnitureFootprint))
  return points
}
