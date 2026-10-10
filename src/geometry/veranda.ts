import { defaultRoof, type Door, type Level, type Point, type Roof, type Slab, type Veranda } from '../domain/types'
import { atWall, wallTangentAngle } from './math'
import { containsPoint } from './polygons'

export function verandaGeometry(level: Level, door: Door) {
  const wall = level.walls.find(item => item.id === door.wallId), veranda = door.veranda
  if (!wall || !veranda) return null
  const anchor = atWall(wall, door.offset + door.width / 2), angle = wallTangentAngle(wall, door.offset + door.width / 2)
  const tangent = { x: Math.cos(angle), z: Math.sin(angle) }, sign = veranda.side === 'left' ? 1 : -1
  const outward = { x: -tangent.z * sign, z: tangent.x * sign }
  const at = (u: number, v: number): Point => ({ x: anchor.x + tangent.x * u + outward.x * v,
    z: anchor.z + tangent.z * u + outward.z * v })
  const width = Math.max(door.width + .3, veranda.width), depth = Math.max(.6, veranda.depth), edge = wall.thickness / 2
  const polygon = [at(-width / 2, edge), at(width / 2, edge), at(width / 2, edge + depth), at(-width / 2, edge + depth)]
  const slab: Slab = { id: `veranda:${door.id}`, polygon, thickness: Math.max(.15, level.slabThickness), elevation: 0,
    structuralMaterial: 'reinforced-concrete', finishMaterial: veranda.floorMaterial, openings: [] }
  return { polygon, slab, anchor, angle, outward, width, depth,
    rails: [[polygon[1], polygon[2]], [polygon[2], polygon[3]], [polygon[3], polygon[0]]] as [Point, Point][] }
}
export function newVeranda(level: Level, door: Door): Veranda {
  const wall = level.walls.find(item => item.id === door.wallId)!
  const anchor = atWall(wall, door.offset + door.width / 2), angle = wallTangentAngle(wall, door.offset + door.width / 2)
  const inside = { x: anchor.x - Math.sin(angle) * .6, z: anchor.z + Math.cos(angle) * .6 }
  return { width: Math.max(2.4, door.width + 1), depth: 1.5, side: level.rooms.some(room => containsPoint(room.polygon, inside)) ? 'right' : 'left',
    covered: true, railing: level.elevation > .5, roofShape: 'shed', floorMaterial: 'tile' }
}
export function verandaCover(level: Level, door: Door, roof = level.roof || defaultRoof) {
  const geometry = verandaGeometry(level, door), veranda = door.veranda
  if (!geometry || !veranda?.covered) return null
  const coverHeight = Math.max(door.height + .35, Math.min(3, (level.floorToFloorHeight || 3.1) - .15))
  const coverRoof: Roof = { ...roof, shape: veranda.roofShape, material: veranda.roofShape === 'terrace' ? 'concrete' : roof.material,
    pitch: veranda.side === 'left' ? -8 : 8, overhang: .18, ridgeDirection: 'x', elevationOffset: 0 }
  return { geometry, roof: coverRoof, bounds: { minX: -geometry.width / 2, maxX: geometry.width / 2,
    minZ: veranda.side === 'left' ? 0 : -geometry.depth, maxZ: veranda.side === 'left' ? geometry.depth : 0, top: coverHeight } }
}
