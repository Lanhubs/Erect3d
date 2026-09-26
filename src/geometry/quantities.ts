import { defaultRoof, type Level } from '../domain/types'
import { roomArea, wallLength } from './math'
import { roofLayout, type Vertex } from './roof'

function faceArea(vertices: Vertex[]) {
  const triangle = (a: Vertex, b: Vertex, c: Vertex) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2]
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]
    return Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2
  }
  return triangle(vertices[0], vertices[1], vertices[2]) +
    (vertices[3] ? triangle(vertices[0], vertices[2], vertices[3]) : 0)
}

export function levelQuantities(level: Level) {
  const wallLengthTotal = level.walls.reduce((sum, wall) => sum + wallLength(wall), 0)
  const grossWallArea = level.walls.reduce((sum, wall) => sum + wallLength(wall) * wall.height * 2, 0)
  const openingsArea = level.doors.reduce((sum, door) => sum + door.width * door.height * 2, 0) +
    level.windows.reduce((sum, window) => sum + window.width * window.height * 2, 0)
  const floorArea = level.rooms.reduce((sum, room) => sum + roomArea(room), 0)
  const finishes = new Map<string, number>()
  for (const room of level.rooms) finishes.set(room.material, (finishes.get(room.material) || 0) + roomArea(room))
  const floorByMaterial = [...finishes].map(([material, area]) => ({ material, area }))
  const points = level.walls.flatMap(wall => [wall.start, wall.end])
  const bounds = points.length ? {
    minX: Math.min(...points.map(point => point.x)), maxX: Math.max(...points.map(point => point.x)),
    minZ: Math.min(...points.map(point => point.z)), maxZ: Math.max(...points.map(point => point.z)),
    top: Math.max(2.7, ...level.walls.map(wall => wall.height)),
  } : null
  const roofArea = bounds ? roofLayout(bounds, level.roof || defaultRoof).faces.reduce((sum, face) => sum + faceArea(face), 0) : 0
  return { floorArea, floorByMaterial, wallLength: wallLengthTotal, wallFinishArea: Math.max(0, grossWallArea - openingsArea),
    roofArea, rooms: level.rooms.length, walls: level.walls.length, doors: level.doors.length, windows: level.windows.length }
}
