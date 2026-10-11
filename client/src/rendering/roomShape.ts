import { Shape } from 'three'
import type { Point, Room } from '../domain/types'
import { polygonArea } from '../geometry/quantities'

type Axis = 'x' | 'z'
function clip(polygon: Point[], axis: Axis, limit: number, keepBelow: boolean): Point[] {
  if (!polygon.length) return []
  const inside = (point: Point) => keepBelow ? point[axis] <= limit + 1e-8 : point[axis] >= limit - 1e-8
  const result: Point[] = []
  for (let index = 0; index < polygon.length; index++) {
    const current = polygon[index], previous = polygon[(index + polygon.length - 1) % polygon.length]
    const currentIn = inside(current), previousIn = inside(previous)
    if (currentIn !== previousIn) {
      const fraction = (limit - previous[axis]) / (current[axis] - previous[axis])
      result.push({ x: previous.x + (current.x - previous.x) * fraction,
        z: previous.z + (current.z - previous.z) * fraction })
    }
    if (currentIn) result.push(current)
  }
  return result
}
function withoutRect(polygon: Point[], opening: Point[]): Point[][] {
  const xs = opening.map(point => point.x), zs = opening.map(point => point.z)
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs)
  const middle = clip(clip(polygon, 'x', minX, false), 'x', maxX, true)
  return [clip(polygon, 'x', minX, true), clip(polygon, 'x', maxX, false),
    clip(middle, 'z', minZ, true), clip(middle, 'z', maxZ, false)].filter(piece => polygonArea(piece) > 1e-5)
}
export function roomShapes(room: Room, openings: Point[][]): Shape[] {
  let polygons = [room.polygon]
  for (const opening of openings.filter(item => item.length >= 3))
    polygons = polygons.flatMap(polygon => withoutRect(polygon, opening))
  return polygons.filter(polygon => polygonArea(polygon) > 1e-5).map(polygon => {
    const shape = new Shape()
    polygon.forEach((point, index) => index ? shape.lineTo(point.x, point.z) : shape.moveTo(point.x, point.z))
    shape.closePath()
    return shape
  })
}
