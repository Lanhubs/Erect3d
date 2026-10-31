import type { Point } from '../domain/types'

/** A CAD entity before layer names are suffixed and handles assigned. */
export type CadEntity =
  | { kind: 'line'; layer: string; a: CadPoint; b: CadPoint }
  | { kind: 'polyline'; layer: string; points: CadPoint[]; closed: boolean }
  | { kind: 'circle'; layer: string; center: CadPoint; radius: number }
  | { kind: 'arc'; layer: string; center: CadPoint; radius: number; from: number; to: number }
  | { kind: 'text'; layer: string; at: CadPoint; height: number; value: string }

/** Metres, Y-up, matching the on-screen plan (model Z grows downwards). */
export type CadPoint = { x: number; y: number; z?: number }

export type CadLayer = { name: string; colour: number }
export type CadScene = {
  entities: CadEntity[]
  layers: CadLayer[]
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
}

/** One model point to one CAD point: X holds, Z flips so north-up plans read the same. */
export const cad = (point: Point): CadPoint => ({ x: point.x, y: -point.z })

export const shift = (point: CadPoint, offset: CadPoint): CadPoint => ({
  x: point.x + offset.x,
  y: point.y + offset.y,
})

export function emptyBounds() {
  return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
}

export function extendBounds(
  bounds: ReturnType<typeof emptyBounds>,
  point: CadPoint,
): ReturnType<typeof emptyBounds> {
  bounds.minX = Math.min(bounds.minX, point.x)
  bounds.minY = Math.min(bounds.minY, point.y)
  bounds.maxX = Math.max(bounds.maxX, point.x)
  bounds.maxY = Math.max(bounds.maxY, point.y)
  return bounds
}

/** Every point an entity occupies, for bounds and elevation scans. */
export function entityPoints(entity: CadEntity): CadPoint[] {
  if (entity.kind === 'line') return [entity.a, entity.b]
  if (entity.kind === 'polyline') return entity.points
  if (entity.kind === 'text') return [entity.at]
  return [entity.center]
}

export function sceneBounds(entities: CadEntity[]) {
  const bounds = emptyBounds()
  for (const entity of entities) {
    for (const point of entityPoints(entity)) extendBounds(bounds, point)
    if (entity.kind === 'circle' || entity.kind === 'arc') {
      extendBounds(bounds, { x: entity.center.x - entity.radius, y: entity.center.y - entity.radius })
      extendBounds(bounds, { x: entity.center.x + entity.radius, y: entity.center.y + entity.radius })
    }
  }
  if (!Number.isFinite(bounds.minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  return bounds
}

/** Keeps AutoCAD layer names legal: 31 characters, no spaces or delimiters. */
export const legalLayer = (name: string) => name.slice(0, 31).replace(/[ <>:;"'`|=]/g, '-')
