import type { Point, Wall } from '../domain/types'
import { distance, nearestPoint, snapWallEnd } from './math'
import type { GridSettings } from '../state/project'

export function constrainPoint(point: Point, walls: Wall[], tolerance: number,
  settings: GridSettings, start?: Point): Point {
  const endpoint = nearestPoint(point, walls, tolerance)
  if (endpoint !== point) return endpoint
  for (const wall of walls) {
    const midpoint = { x: (wall.start.x + wall.end.x) / 2, z: (wall.start.z + wall.end.z) / 2 }
    if (distance(point, midpoint) < tolerance) return midpoint
  }
  let result = start ? snapWallEnd(start, point, walls, tolerance) : point
  if (settings.snap && result === point) result = {
    x: Math.round(point.x / settings.step) * settings.step,
    z: Math.round(point.z / settings.step) * settings.step,
  }
  if (start && (settings.angle || settings.length)) {
    const length = settings.length || distance(start, result)
    const angle = Math.atan2(result.z - start.z, result.x - start.x)
    const step = settings.angle * Math.PI / 180
    const direction = step ? Math.round(angle / step) * step : angle
    result = { x: start.x + Math.cos(direction) * length, z: start.z + Math.sin(direction) * length }
  }
  return result
}
