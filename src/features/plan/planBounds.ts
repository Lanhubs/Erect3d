import type { Level, Point, SiteFence } from '../../domain/types'
import { levelBoundsPoints } from '../../geometry/elementBounds'
export function pointerPlanPoint(svg: SVGSVGElement, event: { clientX: number; clientY: number }, matrix?: DOMMatrix | null): Point {
  const local = svg.createSVGPoint()
  local.x = event.clientX; local.y = event.clientY
  const result = local.matrixTransform(matrix || svg.getScreenCTM()!.inverse())
  return { x: result.x, z: result.y }
}

export type PlanSourceRect = { url: string; x: number; z: number; width: number; height: number }
export type PlanBox = { x: number; z: number; width: number; height: number }
export function fitBounds(level: Level, source?: PlanSourceRect, fence?: SiteFence): PlanBox {
  const points = levelBoundsPoints(level)
  if (source) points.push({ x: source.x, z: source.z }, { x: source.x + source.width, z: source.z + source.height })
  if (fence && fence.enabled !== false) points.push(...(fence.boundary || fence.segments.flatMap(segment => [segment.start, segment.end])))
  if (!points.length) return { x: -1.5, z: -1.5, width: 15, height: 11 }
  const minX = Math.min(...points.map(point => point.x)), maxX = Math.max(...points.map(point => point.x))
  const minZ = Math.min(...points.map(point => point.z)), maxZ = Math.max(...points.map(point => point.z))
  const width = Math.max(4, maxX - minX), height = Math.max(4, maxZ - minZ)
  return { x: minX - width * .08, z: minZ - height * .08, width: width * 1.16, height: height * 1.16 }
}
