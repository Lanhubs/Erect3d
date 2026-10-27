import type { Intelligence } from '../../contracts/analysis'
import { containsPoint } from '../../../../client/src/geometry/polygons'
const words = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '')
// Printed room dimensions span room faces. A bed/table-length reference inside
// that named room must not inflate the entire building, stairs and shaft radii.
export function anchorRoomScale(proposal: Intelligence, width: number, height: number): Intelligence {
  const scale = proposal.understanding?.scale
  if (!scale || scale.origin !== 'annotated') return proposal
  const a = { x: scale.a.x * width, z: scale.a.y * height },
    b = { x: scale.b.x * width, z: scale.b.y * height }
  const horizontal = Math.abs(a.z - b.z) <= 2,
    vertical = Math.abs(a.x - b.x) <= 2
  if (!horizontal && !vertical) return proposal
  const rooms = proposal.candidates.filter(
    (candidate) =>
      candidate.kind === 'room' &&
      words(candidate.label || '').length >= 4 &&
      words(scale.evidence).includes(words(candidate.label || '')),
  )
  if (rooms.length !== 1 || rooms[0].points.length !== 4) return proposal
  const ring = rooms[0].points.map((point) => ({ x: point.x * width, z: point.y * height }))
  if (![a, b].every((point) => containsPoint(ring, point))) return proposal
  const xs = ring.map((point) => point.x),
    zs = ring.map((point) => point.z)
  const left = Math.min(...xs),
    right = Math.max(...xs),
    top = Math.min(...zs),
    bottom = Math.max(...zs)
  if (
    !ring.every(
      (point) =>
        Math.min(Math.abs(point.x - left), Math.abs(point.x - right)) < 1 &&
        Math.min(Math.abs(point.z - top), Math.abs(point.z - bottom)) < 1,
    )
  )
    return proposal
  if (
    ![a, b].every((point) => Math.min(point.x - left, right - point.x, point.z - top, bottom - point.z) > 4)
  )
    return proposal
  const first = horizontal ? { x: left / width, y: scale.a.y } : { x: scale.a.x, y: top / height }
  const last = horizontal ? { x: right / width, y: scale.a.y } : { x: scale.a.x, y: bottom / height }
  return {
    ...proposal,
    understanding: {
      ...proposal.understanding!,
      scale: {
        ...scale,
        a: first,
        b: last,
        evidence: `${scale.evidence} (reference anchored to the named room's opposite faces)`.slice(0, 1000),
      },
    },
    warnings: [
      ...proposal.warnings,
      `The printed dimension for ${rooms[0].label} was anchored to that room's opposite faces; its original endpoints lay inside the room. Review this scale against the drawing.`,
    ].slice(0, 100),
  }
}
