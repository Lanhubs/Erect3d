import type { Level, Point, Room } from '../domain/types'
import { containsPoint } from '../geometry/polygons'
import { cad, type CadEntity } from './types'

/** Area centroid, nudged to the bounding box centre when a concave room puts it outside. */
function anchor(room: Room): Point {
  const polygon = room.polygon
  if (polygon.length < 3) return polygon[0] || { x: 0, z: 0 }
  let twice = 0,
    cx = 0,
    cz = 0
  polygon.forEach((point, index) => {
    const next = polygon[(index + 1) % polygon.length],
      cross = point.x * next.z - next.x * point.z
    twice += cross
    cx += (point.x + next.x) * cross
    cz += (point.z + next.z) * cross
  })
  const result = Math.abs(twice) < 1e-9 ? center(polygon) : { x: cx / (3 * twice), z: cz / (3 * twice) }
  return containsPoint(polygon, result) ? result : center(polygon)
}

const center = (polygon: Point[]): Point => {
  const xs = polygon.map((point) => point.x),
    zs = polygon.map((point) => point.z)
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2 }
}

/** Room outlines plus their names, sized so labels read on plans of any footprint. */
export function roomEntities(level: Level, textHeight: number): CadEntity[] {
  const entities: CadEntity[] = []
  for (const room of level.rooms) {
    if (room.polygon.length < 3) continue
    entities.push({
      kind: 'polyline',
      layer: 'A-ROOM',
      points: room.polygon.map(cad),
      closed: true,
    })
    const name = room.name.trim()
    if (!name) continue
    entities.push({
      kind: 'text',
      layer: 'A-ROOM-NAME',
      at: cad(anchor(room)),
      height: textHeight,
      value: name,
    })
  }
  return entities
}
