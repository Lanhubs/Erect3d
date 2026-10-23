import type { ArticulationSystem } from '../domain/buildingSystems'
import { facadePath } from './facadeSystem'
export function articulationPath(system: ArticulationSystem) {
  const [a, b] = system.path,
    curve = system.curve
  const length = curve
    ? curve.radius * Math.abs(curve.endAngle - curve.startAngle)
    : Math.hypot(b.x - a.x, b.z - a.z)
  const at = (distance: number) => {
    if (curve) {
      const angle = curve.startAngle + ((curve.endAngle - curve.startAngle) * distance) / length,
        sign = Math.sign(curve.endAngle - curve.startAngle)
      return {
        x: curve.center.x + curve.radius * Math.cos(angle),
        z: curve.center.z + curve.radius * Math.sin(angle),
        ux: -Math.sin(angle) * sign,
        uz: Math.cos(angle) * sign,
      }
    }
    return {
      x: a.x + ((b.x - a.x) * distance) / length,
      z: a.z + ((b.z - a.z) * distance) / length,
      ux: (b.x - a.x) / length,
      uz: (b.z - a.z) / length,
    }
  }
  const path = facadePath(system)
  let footprint = system.footprint
  const holes: (typeof path)[] = []
  const closed = !!curve && Math.abs(Math.abs(curve.endAngle - curve.startAngle) - 2 * Math.PI) < 0.00001
  if (curve && !footprint) {
    const side = system.side === 'left' ? 1 : -1
    const outside = path.map((_, i) => {
      const p = at((length * i) / (path.length - 1))
      return { x: p.x - p.uz * system.depth * side, z: p.z + p.ux * system.depth * side }
    })
    if (closed) {
      const host = path.slice(0, -1),
        projected = outside.slice(0, -1)
      const radius = (points: typeof path) =>
        Math.hypot(points[0].x - curve.center.x, points[0].z - curve.center.z)
      footprint = radius(host) > radius(projected) ? host : projected
      holes.push(footprint === host ? projected : host)
    } else footprint = [...path, ...outside.reverse()]
  }
  return { length, at, path, footprint, holes, closed }
}
