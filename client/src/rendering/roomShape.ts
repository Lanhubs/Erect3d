import { Path, Shape, Vector2 } from 'three'
import type { Point, Room } from '../domain/types'
import { roofRegions } from '../geometry/roofRegions'

// Subtract exact polygons; a rotated opening must not remove its whole bounding box.
export function roomShapes(room: Room, openings: Point[][]): Shape[] {
  return roofRegions(
    [room.polygon],
    openings.filter((item) => item.length >= 3),
  ).map((region) => {
    const shape = new Shape(region.footprint.map((point) => new Vector2(point.x, point.z)))
    for (const hole of region.voids) {
      const path = new Path()
      hole.forEach((point, index) => (index ? path.lineTo(point.x, point.z) : path.moveTo(point.x, point.z)))
      path.closePath()
      shape.holes.push(path)
    }
    return shape
  })
}
