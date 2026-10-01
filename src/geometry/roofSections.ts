import type { Point } from '../domain/types'

function clipAt(points: Point[], axis: 'x' | 'z', boundary: number, keepLower: boolean): Point[] {
  const result: Point[] = []
  const inside = (point: Point) => keepLower ? point[axis] <= boundary + 1e-8 : point[axis] >= boundary - 1e-8
  for (let index = 0; index < points.length; index++) {
    const start = points[index], end = points[(index + 1) % points.length]
    const startInside = inside(start), endInside = inside(end)
    if (startInside && endInside) result.push({ ...end })
    else if (startInside !== endInside) {
      const ratio = (boundary - start[axis]) / (end[axis] - start[axis])
      const intersection = { x: start.x + (end.x - start.x) * ratio, z: start.z + (end.z - start.z) * ratio }
      result.push(intersection)
      if (endInside) result.push({ ...end })
    }
  }
  return result.filter((point, index) => {
    const previous = result[(index + result.length - 1) % result.length]
    return Math.hypot(point.x - previous.x, point.z - previous.z) > 1e-7
  })
}

export function splitRoofFootprint(footprint: Point[]): [Point[], Point[]] | null {
  if (footprint.length < 3) return null
  const xs = footprint.map(point => point.x), zs = footprint.map(point => point.z)
  const xSpan = Math.max(...xs) - Math.min(...xs), zSpan = Math.max(...zs) - Math.min(...zs)
  const axis = xSpan >= zSpan ? 'x' : 'z'
  const values = axis === 'x' ? xs : zs
  const middle = (Math.min(...values) + Math.max(...values)) / 2
  const first = clipAt(footprint, axis, middle, true)
  const second = clipAt(footprint, axis, middle, false)
  return first.length >= 3 && second.length >= 3 ? [first, second] : null
}
