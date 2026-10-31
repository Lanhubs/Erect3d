import { containsPolygon } from '../../geometry/polygons'
import { polygonArea } from '../../geometry/quantities'
import type { Level, Point, SlabOpening } from '../../domain/types'

export type Axis = 'x' | 'z'
export const axes: Axis[] = ['x', 'z']
export type VoidSize = { width: number; depth: number }
export type LevelEdit = (change: (draft: Level) => void) => void

/** Numeric text boxes report their string content, so every field coerces through this. */
export const number = (value: string, fallback: number) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback

export const polygonCenter = (polygon: Point[], axis: Axis) =>
  polygon.reduce((sum, point) => sum + point[axis], 0) / polygon.length

/** Slides an opening along one axis so its centroid lands on `value`. */
export function shiftedPolygon(polygon: Point[], axis: Axis, value: number): Point[] {
  const center = polygonCenter(polygon, axis)
  return polygon.map((point) => ({ ...point, [axis]: point[axis] + value - center }))
}

export function outlineUpdated(polygon: Point[], index: number, axis: Axis, value: number): Point[] {
  return polygon.map((point, position) => (position === index ? { ...point, [axis]: value } : point))
}

export const outlineRejected = (polygon: Point[], openings: SlabOpening[]) =>
  polygonArea(polygon) < 0.1 || openings.some((opening) => !containsPolygon(polygon, opening.polygon))

/** The centred void the "Add opening" button drops in: never wider than the slab minus 0.2 m. */
export function centeredVoid(polygon: Point[], width: number, depth: number): Point[] {
  const xs = polygon.map((point) => point.x),
    zs = polygon.map((point) => point.z)
  const x = (Math.min(...xs) + Math.max(...xs)) / 2,
    z = (Math.min(...zs) + Math.max(...zs)) / 2
  const w = Math.min(width, Math.max(0.1, Math.max(...xs) - Math.min(...xs) - 0.2)),
    d = Math.min(depth, Math.max(0.1, Math.max(...zs) - Math.min(...zs) - 0.2))
  return [
    { x: x - w / 2, z: z - d / 2 },
    { x: x + w / 2, z: z - d / 2 },
    { x: x + w / 2, z: z + d / 2 },
    { x: x - w / 2, z: z + d / 2 },
  ]
}

export const stairFields = ['direction', 'width', 'riserHeight', 'treadDepth', 'landingLength'] as const
export type StairField = (typeof stairFields)[number]

export const stairFieldLabel = (field: StairField) =>
  field === 'direction'
    ? 'Direction · °'
    : `${field.replace(/[A-Z]/g, (value) => ` ${value.toLowerCase()}`)} · m`

export const stairFieldStep = (field: StairField) => (field === 'direction' ? 5 : 0.01)

/** Columns keep a square section, so one box drives all three stored dimensions. */
export const squareColumn = (value: number) => ({ width: value, depth: value, diameter: value })
