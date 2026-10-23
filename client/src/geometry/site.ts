import { uid, type Building, type Level, type Point, type SiteFence } from '../domain/types'
import { buildingEnvelope, envelopeRectangle } from './siteEnvelope'

export type SiteSetbacks = { front: number; rear: number; left: number; right: number }
const defaultSetbacks: SiteSetbacks = { front: 4, rear: 3, left: 3, right: 3 }

export function insertBoundaryPoint(boundary: Point[]): Point[] {
  if (boundary.length < 3) return boundary.map((point) => ({ ...point }))
  let longestIndex = 0,
    longest = -1
  boundary.forEach((point, index) => {
    const next = boundary[(index + 1) % boundary.length]
    const distance = Math.hypot(next.x - point.x, next.z - point.z)
    if (distance > longest) {
      longest = distance
      longestIndex = index
    }
  })
  const start = boundary[longestIndex],
    end = boundary[(longestIndex + 1) % boundary.length]
  const next = boundary.map((point) => ({ ...point }))
  next.splice(longestIndex + 1, 0, { x: (start.x + end.x) / 2, z: (start.z + end.z) / 2 })
  return next
}

export function groundFootprint(level: Level): Point[] {
  return envelopeRectangle(buildingEnvelope(level).flat())
}

export function segmentsFromBoundary(boundary: Point[], previous?: SiteFence): SiteFence['segments'] {
  return boundary.map((start, index) => ({
    ...previous?.segments[index],
    id: previous?.segments[index]?.id || uid('fence-segment'),
    start: { ...start },
    end: { ...boundary[(index + 1) % boundary.length] },
    height: previous?.segments[index]?.height ?? previous?.height ?? 1.5,
    thickness: previous?.segments[index]?.thickness ?? previous?.thickness ?? 0.12,
    material: previous?.segments[index]?.material ?? previous?.material ?? 'metal',
  }))
}

export function updateFenceBoundary(fence: SiteFence, boundary: Point[]): SiteFence {
  if (boundary.length < 3 || boundary.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.z)))
    return fence
  const segments = segmentsFromBoundary(boundary, fence)
  const gates = fence.gates.flatMap((gate) => {
    const oldIndex = fence.segments.findIndex((segment) => segment.id === gate.segmentId)
    const old = fence.segments[oldIndex]
    if (!old) return []
    let segment = segments[oldIndex],
      offset = gate.offset
    if (segments.length !== fence.segments.length) {
      const oldLength = Math.hypot(old.end.x - old.start.x, old.end.z - old.start.z) || 1
      const position = {
        x: old.start.x + ((old.end.x - old.start.x) * gate.offset) / oldLength,
        z: old.start.z + ((old.end.z - old.start.z) * gate.offset) / oldLength,
      }
      const closest = segments
        .map((item) => {
          const dx = item.end.x - item.start.x,
            dz = item.end.z - item.start.z,
            length = Math.hypot(dx, dz)
          const along = length
            ? ((position.x - item.start.x) * dx + (position.z - item.start.z) * dz) / length
            : 0
          const start = Math.max(0, Math.min(Math.max(0, length - gate.width), along))
          return {
            item,
            start,
            length,
            distance: Math.hypot(
              position.x - item.start.x - (dx * start) / (length || 1),
              position.z - item.start.z - (dz * start) / (length || 1),
            ),
          }
        })
        .filter((item) => item.length >= gate.width)
        .sort((a, b) => a.distance - b.distance)[0]
      if (!closest) return []
      segment = closest.item
      offset = closest.start
    }
    if (!segment) return []
    const length = Math.hypot(segment.end.x - segment.start.x, segment.end.z - segment.start.z)
    return length > 0.1
      ? [
          {
            ...gate,
            segmentId: segment.id,
            width: Math.min(gate.width, length),
            offset: Math.max(0, Math.min(offset, Math.max(0, length - Math.min(gate.width, length)))),
          },
        ]
      : []
  })
  return { ...fence, mode: 'manual', boundary: boundary.map((point) => ({ ...point })), segments, gates }
}

export function generateSiteFence(
  input: Level | Building,
  setbacks: SiteSetbacks = defaultSetbacks,
  previous?: SiteFence,
): SiteFence | undefined {
  setbacks = Object.fromEntries(
    Object.entries(defaultSetbacks).map(([side, fallback]) => [
      side,
      Number.isFinite(setbacks[side as keyof SiteSetbacks])
        ? Math.max(0, setbacks[side as keyof SiteSetbacks])
        : fallback,
    ]),
  ) as SiteSetbacks
  const footprint = envelopeRectangle(buildingEnvelope(input).flat())
  if (!footprint.length) return undefined
  const xs = footprint.map((point) => point.x),
    zs = footprint.map((point) => point.z)
  const clearance =
    Math.max(previous?.thickness || 0.12, ...(previous?.segments.map((s) => s.thickness) || [])) / 2 + 0.02
  const minX = Math.min(...xs) - Math.max(clearance, setbacks.left),
    maxX = Math.max(...xs) + Math.max(clearance, setbacks.right)
  const minZ = Math.min(...zs) - Math.max(clearance, setbacks.front),
    maxZ = Math.max(...zs) + Math.max(clearance, setbacks.rear)
  const boundary = [
    { x: minX, z: minZ },
    { x: maxX, z: minZ },
    { x: maxX, z: maxZ },
    { x: minX, z: maxZ },
  ]
  const base: SiteFence = previous || {
    id: uid('site-fence'),
    name: 'Site fence',
    height: 1.5,
    thickness: 0.12,
    material: 'metal',
    segments: [],
    gates: [],
  }
  return {
    ...updateFenceBoundary(base, boundary),
    mode: 'automatic',
    enabled: previous?.enabled ?? true,
    setbacks: { ...setbacks },
  }
}

export function repairGeneratedFence(building: Building) {
  const fence = building.siteFence,
    ground = building.levels.toSorted((a, b) => a.elevation - b.elevation)[0]
  if (!fence || !ground || fence.mode === 'manual') return
  const first = ground.slabs?.find((slab) => slab.elevation <= 0.05 && slab.polygon.length >= 3)
  const setback = fence.setbacks,
    boundary = fence.boundary
  const legacyPartial =
    first &&
    setback &&
    boundary?.length === 4 &&
    (() => {
      const xs = first.polygon.map((p) => p.x),
        zs = first.polygon.map((p) => p.z)
      const expected = [
        { x: Math.min(...xs) - setback.left, z: Math.min(...zs) - setback.front },
        { x: Math.max(...xs) + setback.right, z: Math.min(...zs) - setback.front },
        { x: Math.max(...xs) + setback.right, z: Math.max(...zs) + setback.rear },
        { x: Math.min(...xs) - setback.left, z: Math.max(...zs) + setback.rear },
      ]
      return boundary.every((p, i) => Math.hypot(p.x - expected[i].x, p.z - expected[i].z) < 1e-5)
    })()
  if (fence.mode === 'automatic' || legacyPartial) {
    const enabled = fence.enabled,
      fitted = generateSiteFence(building, setback, fence)
    if (fitted) {
      const next = { ...fitted, enabled }
      if (JSON.stringify(next) !== JSON.stringify(fence)) building.siteFence = next
    }
  }
}

export function siteBounds(fence?: SiteFence) {
  if (!fence || fence.enabled === false) return undefined
  const points = fence.boundary?.length
    ? fence.boundary
    : fence.segments.flatMap((segment) => [segment.start, segment.end])
  if (!points.length) return undefined
  return {
    minX: Math.min(...points.map((point) => point.x)),
    maxX: Math.max(...points.map((point) => point.x)),
    minZ: Math.min(...points.map((point) => point.z)),
    maxZ: Math.max(...points.map((point) => point.z)),
  }
}
