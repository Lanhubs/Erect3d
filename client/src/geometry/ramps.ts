import type { Point, Ramp } from '../domain/types'

export function rampHeightAt(ramp: Ramp, point: Point): number | null {
  const dx = ramp.end.x - ramp.start.x,
    dz = ramp.end.z - ramp.start.z
  const lengthSquared = dx * dx + dz * dz
  if (lengthSquared < 0.0001) return null
  const t = ((point.x - ramp.start.x) * dx + (point.z - ramp.start.z) * dz) / lengthSquared
  if (t < 0 || t > 1) return null
  const projected = { x: ramp.start.x + dx * t, z: ramp.start.z + dz * t }
  const lateral = Math.hypot(point.x - projected.x, point.z - projected.z)
  if (lateral > ramp.width / 2) return null
  return ramp.startElevation + (ramp.endElevation - ramp.startElevation) * t
}
