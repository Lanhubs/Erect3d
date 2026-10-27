import type { Candidate, Intelligence } from '../contracts/analysis'
type Point = { x: number; z: number }
// An AI may describe the swung leaf rather than the closed doorway. Recover a
// single-leaf gap only with a real perpendicular host AND a matching source arc.
export function recoverSourceDoorLeaves(
  proposal: Intelligence,
  width: number,
  height: number,
  ink: (x: number, y: number) => boolean,
) {
  const pixel = (point: { x: number; y: number }) => ({ x: point.x * width, z: point.y * height })
  const walls = proposal.candidates.filter(
    (wall) => wall.kind === 'wall' && !wall.curve && wall.points.length === 2 && wall.confidence >= 0.7,
  )
  const nearInk = (point: Point) => {
    for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) if (ink(point.x + x, point.z + y)) return true
    return false
  }
  let changed = false
  const candidates = proposal.candidates.map((door) => {
    if (
      door.kind !== 'door' ||
      door.targetId ||
      door.points.length !== 2 ||
      ['double', 'sectional'].includes(door.doorStyle || '')
    )
      return door
    const points = door.points.map(pixel),
      span = Math.hypot(points[1].x - points[0].x, points[1].z - points[0].z)
    if (span < 8 || span > Math.min(width, height) * 0.12) return door
    const host = walls.find((wall) => wall.id === door.wallId)
    if (host) {
      const [a, b] = host.points.map(pixel),
        dx = b.x - a.x,
        dz = b.z - a.z,
        length = Math.hypot(dx, dz)
      const parallel =
        length &&
        Math.abs(((points[1].x - points[0].x) * dx + (points[1].z - points[0].z) * dz) / (length * span)) >
          0.98
      const tolerance = Math.max(2, ((host.thickness || 0) * width) / 2) + 1
      if (
        parallel &&
        points.every((point) => {
          const offset = ((point.x - a.x) * dx + (point.z - a.z) * dz) / length
          return (
            offset >= -tolerance &&
            offset <= length + tolerance &&
            Math.abs((point.x - a.x) * dz - (point.z - a.z) * dx) / length <= tolerance
          )
        })
      )
        return door
    }
    const matches: {
      wall: Candidate
      hinge: Point
      end: Point
      score: number
      side: number
      offset: number
      closedOffset: number
    }[] = []
    for (const wall of walls) {
      const [a, b] = wall.points.map(pixel),
        dx = b.x - a.x,
        dz = b.z - a.z,
        length = Math.hypot(dx, dz)
      if (!length || (wall.thickness || 0) * width > span / 2) continue
      const ux = dx / length,
        uz = dz / length,
        tolerance = Math.max(2, ((wall.thickness || 0) * width) / 2) + 2
      if (Math.abs(((points[1].x - points[0].x) * ux + (points[1].z - points[0].z) * uz) / span) > 0.15)
        continue
      for (const index of [0, 1]) {
        const hingePoint = points[index],
          tip = points[1 - index]
        const offset = (hingePoint.x - a.x) * ux + (hingePoint.z - a.z) * uz
        const hinge = { x: a.x + offset * ux, z: a.z + offset * uz }
        if (
          offset < 0 ||
          offset > length ||
          Math.hypot(hingePoint.x - hinge.x, hingePoint.z - hinge.z) > tolerance
        )
          continue
        const leafLength = Math.hypot(tip.x - hinge.x, tip.z - hinge.z)
        const vx = (tip.x - hinge.x) / leafLength,
          vz = (tip.z - hinge.z) / leafLength
        for (const fraction of [0.8, 0.9, 1, 1.1])
          for (const direction of [-1, 1]) {
            const radius = leafLength * fraction,
              closedOffset = offset + direction * radius
            if (radius < 8 || closedOffset < 0 || closedOffset > length) continue
            let arc = 0,
              clear = 0,
              leaf = 0
            for (let i = 0; i < 17; i++) {
              const angle = ((20 + (i * 50) / 16) * Math.PI) / 180
              const at = (r: number) => ({
                x: hinge.x + vx * r * Math.cos(angle) + direction * ux * r * Math.sin(angle),
                z: hinge.z + vz * r * Math.cos(angle) + direction * uz * r * Math.sin(angle),
              })
              if (nearInk(at(radius))) arc++
              if (!nearInk(at(radius - 4)) && !nearInk(at(radius + 4))) clear++
            }
            for (let i = 2; i <= 8; i++)
              if (nearInk({ x: hinge.x + (vx * radius * i) / 8, z: hinge.z + (vz * radius * i) / 8 })) leaf++
            if (arc < 13 || leaf < 5 || clear < 10) continue
            matches.push({
              wall,
              hinge,
              end: { x: a.x + closedOffset * ux, z: a.z + closedOffset * uz },
              score: arc / 17 + leaf / 7 + clear / 17,
              side: vx * -uz + vz * ux,
              offset,
              closedOffset,
            })
          }
      }
    }
    matches.sort((a, b) => b.score - a.score)
    const best = matches[0]
    if (
      !best ||
      matches.some(
        (match) =>
          best.score - match.score < 0.1 &&
          (match.wall.id !== best.wall.id ||
            Math.hypot(match.end.x - best.end.x, match.end.z - best.end.z) > 4),
      )
    )
      return door
    changed = true
    return {
      ...door,
      wallId: best.wall.id,
      points: [best.hinge, best.end].map((point) => ({ x: point.x / width, y: point.z / height })),
      hinge: best.offset < best.closedOffset ? ('left' as const) : ('right' as const),
      swing: best.side < 0 ? ('in' as const) : ('out' as const),
      confidence: Math.max(door.confidence, 0.8),
      uncertainties: [
        ...door.uncertainties,
        'Closed doorway recovered from the source leaf, quarter-circle swing and existing wall; review the opening.',
      ].slice(0, 20),
    }
  })
  return changed ? { ...proposal, candidates } : proposal
}
