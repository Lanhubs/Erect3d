import type { Level, Point, Room } from '../domain/types'
import type { VisionBrief } from '../../../api/src/contracts/vision'
export function arenaLayout(level: Level, court: Room, brief: VisionBrief) {
  const center = court.polygon.reduce(
    (a, p) => ({ x: a.x + p.x / court.polygon.length, z: a.z + p.z / court.polygon.length }),
    { x: 0, z: 0 },
  )
  const edge = court.polygon
    .map((a, i) => ({ a, b: court.polygon[(i + 1) % court.polygon.length] }))
    .sort((a, b) => Math.hypot(b.a.x - b.b.x, b.a.z - b.b.z) - Math.hypot(a.a.x - a.b.x, a.a.z - a.b.z))[0]
  const rotation = Math.atan2(edge.b.z - edge.a.z, edge.b.x - edge.a.x),
    c = Math.cos(rotation),
    s = Math.sin(rotation)
  const local = (p: Point) => ({
    x: (p.x - center.x) * c + (p.z - center.z) * s,
    z: -(p.x - center.x) * s + (p.z - center.z) * c,
  })
  const world = (x: number, z: number): Point => ({
    x: center.x + x * c - z * s,
    z: center.z + x * s + z * c,
  })
  const courtPoints = court.polygon.map(local),
    points = level.walls.flatMap((wall) => [local(wall.start), local(wall.end)])
  const innerX = Math.max(...courtPoints.map((p) => Math.abs(p.x))) + 2,
    innerZ = Math.max(...courtPoints.map((p) => Math.abs(p.z))) + 3
  const radiusX = Math.max(
    innerX + brief.seatingRows * 0.82 + brief.concourseWidth + 3,
    ...points.map((p) => Math.abs(p.x) * 0.9),
  )
  const radiusZ = Math.max(
    innerZ + brief.seatingRows * 0.82 + brief.concourseWidth + 3,
    ...points.map((p) => Math.abs(p.z) * 0.9),
  )
  const rows = Math.max(
    4,
    Math.min(
      brief.seatingRows,
      Math.floor(
        Math.min(radiusX - innerX - brief.concourseWidth - 1, radiusZ - innerZ - brief.concourseWidth - 1) /
          0.82,
      ),
    ),
  )
  const ellipse = (rx: number, rz: number, count = 64) =>
    Array.from({ length: count }, (_, i) =>
      world(rx * Math.cos((i / count) * Math.PI * 2), rz * Math.sin((i / count) * Math.PI * 2)),
    )
  return {
    center,
    rotation,
    world,
    ellipse,
    radiusX,
    radiusZ,
    innerX,
    innerZ,
    rows,
    bowlX: innerX + rows * 0.82 + 1,
    bowlZ: innerZ + rows * 0.82 + 1,
  }
}
export type ArenaLayout = ReturnType<typeof arenaLayout>
