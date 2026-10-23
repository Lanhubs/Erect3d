import type { Point, Wall } from '../../../../client/src/domain/types'
export function boundaryWallIds(walls: Wall[], points: Point[], closed: boolean) {
  const distance = (p: Point, a: Point, b: Point) => {
    const dx = b.x - a.x,
      dz = b.z - a.z,
      length2 = dx * dx + dz * dz
    if (length2 < 1e-10) return Infinity
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / length2))
    return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz)
  }
  return walls
    .filter((wall) =>
      points.slice(0, closed ? points.length : -1).some((a, i) => {
        const b = points[(i + 1) % points.length],
          tolerance = wall.thickness * 0.6 + 0.05
        return distance(wall.start, a, b) < tolerance && distance(wall.end, a, b) < tolerance
      }),
    )
    .map((w) => w.id)
}
