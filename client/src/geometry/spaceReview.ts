import type { Point } from '../domain/types'

// Geometry keys keep a choice attached to its space when other faces disappear.
export function spaceKey(polygon: Point[]): string {
  return polygon
    .map((point) => `${point.x.toFixed(4)},${point.z.toFixed(4)}`)
    .sort()
    .join(';')
}

export function includedSpaces(polygons: Point[][], choices: Record<string, boolean>): Point[][] {
  return polygons.filter((polygon) => choices[spaceKey(polygon)] !== false)
}
