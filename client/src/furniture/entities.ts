import { uid, type Level, type Point } from '../domain/types'
import { containsPoint } from '../geometry/polygons'
import { nearestWallOffset, wallSubpath } from '../geometry/math'
import { stairOpening } from '../geometry/stairs'
import type { FurnitureObject, FurnitureType } from './types'
export const variants = (type: FurnitureType) => type === 'bed' ? ['single', 'double', 'queen', 'king']
  : type === 'sofa' ? ['2-seat', '3-seat', 'sectional'] : type === 'dining-table' ? ['4-seat', '6-seat', '8-seat','round','oval'] : type==='coffee-table'?['standard','round','oval']:['standard']
export function furnitureDimensions(type: FurnitureType, variant = variants(type)[0]): [number, number, number] {
  if (type === 'bed') return [({ single: 1, double: 1.4, queen: 1.6, king: 1.9 } as Record<string, number>)[variant] || 1.6, 2.05, 1]
  if (type === 'sofa') return [variant === '2-seat' ? 1.7 : 2.3, variant === 'sectional' ? 1.6 : .9, .85]
  if (type === 'dining-table') return variant==='round'?[1.25,1.25,.76]:[variant === '4-seat' ? 1.3 : variant === '8-seat' ? 2.3 : 1.8, variant==='oval'?1:.9, .76]
  if (['armchair', 'office-chair', 'dining-chair'].includes(type)) return [.6, .6, .85]
  if (type === 'bathtub') return [.8, 1.7, .6]
  if (type === 'toilet') return [.42, .7, .8]
  if (type === 'shower') return [.9, .9, 2]
  if (['refrigerator', 'wardrobe', 'storage-cabinet'].includes(type)) return [type === 'wardrobe' ? 1.8 : .75, .65, 2]
  if (type === 'bedside-table') return [.5, .45, .5]
  if (type === 'coffee-table') return [1.1, .6, .42]
  if (type === 'kitchen-island') return [1.8, .9, .9]
  return [type === 'desk' || type === 'television-unit' ? 1.4 : .65, .6, .85]
}
export function newFurniture(level: Level, type: FurnitureType, position: Point): FurnitureObject {
  const [width, depth, height] = furnitureDimensions(type)
  const object: FurnitureObject = { id: uid('furniture'), type, levelId: level.id, position, rotation: 0, width, depth, height, assetId: variants(type)[0] }
  object.roomId = furnitureIssues(object, level).roomId; return object
}
export const estimatedVariant = (type: FurnitureType, width: number) => variants(type).reduce((best, variant) =>
  Math.abs(furnitureDimensions(type, variant)[0] - width) < Math.abs(furnitureDimensions(type, best)[0] - width) ? variant : best)
export function furnitureFootprint(object: FurnitureObject): Point[] {
  const angle = object.rotation * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle)
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => ({
    x: object.position.x + a * object.width / 2 * c - b * object.depth / 2 * s,
    z: object.position.z + a * object.width / 2 * s + b * object.depth / 2 * c }))
}
function crosses(a: Point, b: Point, c: Point, d: Point) {
  const side = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x)
  return side(a, b, c) * side(a, b, d) < -1e-10 && side(c, d, a) * side(c, d, b) < -1e-10
}
const crossesRing = (a: Point, b: Point, polygon: Point[]) => polygon.some((p, i) => crosses(a, b, p, polygon[(i + 1) % polygon.length]))
export function furnitureIssues(object: FurnitureObject, level: Level, levels: Level[] = [level]) {
  const polygon = furnitureFootprint(object), issues: string[] = []
  const room = level.rooms.find(room => polygon.every(point => containsPoint(room.polygon, point)))
  const floors = level.slabs?.map(slab => slab.polygon) || []
  if (!room && !floors.some(floor => polygon.every(point => containsPoint(floor, point)))) issues.push('Outside a complete room or floor footprint')
  const samples = [...polygon, object.position, ...polygon.map((p, i) => ({ x: (p.x + polygon[(i + 1) % 4].x) / 2, z: (p.z + polygon[(i + 1) % 4].z) / 2 }))]
  if (level.walls.some(wall => samples.some(point => nearestWallOffset(wall, point).distance < wall.thickness / 2 + .02)
    || containsPoint(polygon, wall.start) || containsPoint(polygon, wall.end)
    || wallSubpath(wall).some((p, i, path) => i > 0 && crossesRing(path[i - 1], p, polygon)))) issues.push('Intersects a wall or doorway')
  if (level.stairs?.some(stair => stairOpening(stair, levels).some(point => containsPoint(polygon, point))
    || polygon.some(point => containsPoint(stairOpening(stair, levels), point)))) issues.push('Obstructs a staircase')
  if (level.slabs?.some(slab => slab.openings.some(opening => containsPoint(opening.polygon, object.position)
    || polygon.some(point => containsPoint(opening.polygon, point))))) issues.push('Over a floor opening')
  if (['toilet', 'bathroom-sink', 'bathtub', 'shower'].includes(object.type) && room && !/bath|wc|toilet|wash/i.test(room.name)) issues.push('Confirm that this room is a bathroom')
  return { issues, roomId: room?.id }
}
export const blocksWalking = (type: FurnitureType) => !['bedside-table', 'dining-chair', 'office-chair', 'unknown'].includes(type)
