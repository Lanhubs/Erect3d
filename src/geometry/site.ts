import { uid, type Level, type Point, type SiteFence } from '../domain/types'

export type SiteSetbacks = { front: number; rear: number; left: number; right: number }
const defaultSetbacks: SiteSetbacks = { front: 4, rear: 3, left: 3, right: 3 }

export function insertBoundaryPoint(boundary: Point[]): Point[] {
  if (boundary.length < 3) return boundary.map(point => ({ ...point }))
  let longestIndex = 0, longest = -1
  boundary.forEach((point, index) => {
    const next = boundary[(index + 1) % boundary.length]
    const distance = Math.hypot(next.x - point.x, next.z - point.z)
    if (distance > longest) { longest = distance; longestIndex = index }
  })
  const start = boundary[longestIndex], end = boundary[(longestIndex + 1) % boundary.length]
  const next = boundary.map(point => ({ ...point }))
  next.splice(longestIndex + 1, 0, { x: (start.x + end.x) / 2, z: (start.z + end.z) / 2 })
  return next
}

export function groundFootprint(level: Level): Point[] {
  const slab = level.slabs?.find(item => item.elevation <= .05 && item.polygon.length >= 3)
  if (slab) return slab.polygon.map(point => ({ ...point }))
  const exterior = level.walls.filter(wall => wall.kind === 'exterior')
  const edges = exterior.length ? exterior : level.walls
  if (!edges.length) return []
  const halfThickness = Math.max(0, ...edges.map(wall => wall.thickness / 2))
  const xs = edges.flatMap(wall => [wall.start.x, wall.end.x])
  const zs = edges.flatMap(wall => [wall.start.z, wall.end.z])
  const minX = Math.min(...xs) - halfThickness, maxX = Math.max(...xs) + halfThickness
  const minZ = Math.min(...zs) - halfThickness, maxZ = Math.max(...zs) + halfThickness
  return [{ x: minX, z: minZ }, { x: maxX, z: minZ }, { x: maxX, z: maxZ }, { x: minX, z: maxZ }]
}

export function segmentsFromBoundary(boundary: Point[], previous?: SiteFence): SiteFence['segments'] {
  return boundary.map((start, index) => ({
    id: previous?.segments[index]?.id || uid('fence-segment'), start: { ...start },
    end: { ...boundary[(index + 1) % boundary.length] }, height: previous?.height || 1.5,
    thickness: previous?.thickness || .12, material: previous?.material || 'metal',
  }))
}

export function updateFenceBoundary(fence: SiteFence, boundary: Point[]): SiteFence {
  const segments = segmentsFromBoundary(boundary, fence)
  const gates = fence.gates.flatMap(gate => {
    const oldIndex = fence.segments.findIndex(segment => segment.id === gate.segmentId)
    const segment = segments[oldIndex]
    return segment ? [{ ...gate, segmentId: segment.id, offset: Math.min(gate.offset, Math.max(0,
      Math.hypot(segment.end.x - segment.start.x, segment.end.z - segment.start.z) - gate.width)) }] : []
  })
  return { ...fence, boundary: boundary.map(point => ({ ...point })), segments, gates }
}

export function generateSiteFence(level: Level, setbacks: SiteSetbacks = defaultSetbacks, previous?: SiteFence): SiteFence | undefined {
  const footprint = groundFootprint(level)
  if (!footprint.length) return undefined
  const xs = footprint.map(point => point.x), zs = footprint.map(point => point.z)
  const minX = Math.min(...xs) - setbacks.left, maxX = Math.max(...xs) + setbacks.right
  const minZ = Math.min(...zs) - setbacks.front, maxZ = Math.max(...zs) + setbacks.rear
  const boundary = [{ x: minX, z: minZ }, { x: maxX, z: minZ }, { x: maxX, z: maxZ }, { x: minX, z: maxZ }]
  const base: SiteFence = previous || { id: uid('site-fence'), name: 'Site fence', height: 1.5, thickness: .12,
    material: 'metal', segments: [], gates: [] }
  return { ...base, enabled: true, boundary, setbacks: { ...setbacks }, segments: segmentsFromBoundary(boundary, base) }
}

export function siteBounds(fence?: SiteFence) {
  if (!fence || fence.enabled === false) return undefined
  const points = fence.boundary?.length ? fence.boundary : fence.segments.flatMap(segment => [segment.start, segment.end])
  if (!points.length) return undefined
  return { minX: Math.min(...points.map(point => point.x)), maxX: Math.max(...points.map(point => point.x)),
    minZ: Math.min(...points.map(point => point.z)), maxZ: Math.max(...points.map(point => point.z)) }
}