import type { Point, Wall } from '../domain/types'
export const dot = (a: Point, b: Point) => a.x * b.x + a.z * b.z
export const subtract = (a: Point, b: Point): Point => ({ x: a.x - b.x, z: a.z - b.z })
export const advance = (origin: Point, unit: Point, amount: number): Point => ({
  x: origin.x + unit.x * amount,
  z: origin.z + unit.z * amount,
})
export function wallLine(wall: Wall) {
  if (wall.curve) return null
  const reverse =
    wall.end.x < wall.start.x - 0.001 ||
    (Math.abs(wall.end.x - wall.start.x) < 0.001 && wall.end.z < wall.start.z)
  const start = reverse ? wall.end : wall.start,
    end = reverse ? wall.start : wall.end
  const delta = subtract(end, start),
    length = Math.hypot(delta.x, delta.z)
  return length > 0.12 ? { start, end, unit: { x: delta.x / length, z: delta.z / length }, length } : null
}
