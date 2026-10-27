import type { Intelligence } from '../contracts/analysis'
import { ApiError } from '../security/errors'
import { validateFootprint, validRing } from '../modules/plan-analysis/footprint-validation'
type Point = { x: number; z: number }
const cross = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)
const area = (ring: Point[]) =>
  Math.abs(
    ring.reduce((sum, point, i) => {
      const next = ring[(i + 1) % ring.length]
      return sum + point.x * next.z - next.x * point.z
    }, 0),
  ) / 2
function intersection(subject: Point[], clip: Point[]) {
  const sign = Math.sign(cross(clip[0], clip[1], clip[2]))
  if (
    !sign ||
    !clip.every(
      (point, i) => cross(point, clip[(i + 1) % clip.length], clip[(i + 2) % clip.length]) * sign > 0,
    )
  )
    return []
  let result = subject
  for (let i = 0; i < clip.length; i++) {
    const a = clip[i],
      b = clip[(i + 1) % clip.length],
      previous = result
    result = []
    for (let j = 0; j < previous.length; j++) {
      const p = previous[j],
        q = previous[(j + 1) % previous.length]
      const first = cross(a, b, p) * sign,
        last = cross(a, b, q) * sign
      if (first >= -1e-7) result.push(p)
      if (first >= 0 !== last >= 0) {
        const t = first / (first - last)
        result.push({ x: p.x + (q.x - p.x) * t, z: p.z + (q.z - p.z) * t })
      }
    }
    if (result.length < 3) return []
  }
  return result.filter(
    (point, i) =>
      Math.hypot(point.x - result[(i + 1) % result.length].x, point.z - result[(i + 1) % result.length].z) >
      1e-5,
  )
}
// Recover a stepped room from a coarse rectangular detection only when its
// small clipped corners follow actual source ink. Never fill a courtyard or
// force an entirely misplaced room into the house.
export function fitSourceRooms(
  proposal: Intelligence,
  width: number,
  height: number,
  supported: (a: Point, b: Point) => boolean,
) {
  const footprint = proposal.understanding?.footprint.map((point) => ({
    x: point.x * width,
    z: point.y * height,
  }))
  if (!footprint || !validRing(footprint)) return proposal
  let changed = false
  const candidates = proposal.candidates.map((room) => {
    if (
      room.kind !== 'room' ||
      room.targetId ||
      room.confidence < 0.7 ||
      room.points.length !== 4 ||
      /court|atrium|balcon|terrace|patio|deck|pool|open.*below/i.test(room.label || '')
    )
      return room
    try {
      validateFootprint(proposal, [room], width, height)
      return room
    } catch (error) {
      if (!(error instanceof ApiError) || error.code !== 'OUTSIDE_FOOTPRINT') return room
    }
    const original = room.points.map((point) => ({ x: point.x * width, z: point.y * height }))
    const fitted = intersection(footprint, original)
    if (!validRing(fitted) || area(fitted) < area(original) * 0.85) return room
    // Only the new boundary needs proof; an original room edge may be an
    // open-plan division and must not be turned into a fabricated wall.
    const onOriginal = (a: Point, b: Point) =>
      original.some((p, i) => {
        const q = original[(i + 1) % original.length],
          length = Math.hypot(q.x - p.x, q.z - p.z)
        return Math.abs(cross(p, q, a)) / length < 0.01 && Math.abs(cross(p, q, b)) / length < 0.01
      })
    if (
      !fitted.every(
        (a, i) =>
          onOriginal(a, fitted[(i + 1) % fitted.length]) || supported(a, fitted[(i + 1) % fitted.length]),
      )
    )
      return room
    const next = {
      ...room,
      points: fitted.map((point) => ({ x: point.x / width, y: point.z / height })),
      uncertainties: [
        ...room.uncertainties,
        'Rectangular room detection fitted to the source-supported stepped building boundary.',
      ].slice(0, 20),
    }
    try {
      validateFootprint(proposal, [next], width, height)
    } catch {
      return room
    }
    changed = true
    return next
  })
  return changed
    ? {
        ...proposal,
        candidates,
        warnings: [
          ...proposal.warnings,
          'Small exterior corners of coarse room rectangles were fitted to source-supported facade steps; review the resulting room outlines.',
        ].slice(0, 100),
      }
    : proposal
}
