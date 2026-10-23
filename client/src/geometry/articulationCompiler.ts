import type { ArticulationSystem } from '../domain/buildingSystems'
import type { InstancePart } from '../rendering/EntityInstances'
import type { Level } from '../domain/types'
import { articulationOpenings } from './articulationOpenings'
import { subtractFacadeOpenings } from './facadeOpenings'
import { articulationPath } from './articulationPath'
// Placements retain semantic ownership. Local X follows the source path;
// local +Z projects to its left. All dimensions and elevations are metres.
export function articulationParts(system: ArticulationSystem, level?: Level) {
  const body: InstancePart[] = [],
    edge: InstancePart[] = [],
    glass: InstancePart[] = [],
    columns: InstancePart[] = []
  const { length, at, path, footprint, holes, closed } = articulationPath(system),
    side = system.side === 'left' ? 1 : -1,
    t = system.thickness,
    h = system.height,
    d = system.depth
  const count = Math.max(1, Math.ceil(length / system.spacing))
  if (!Number.isSafeInteger(count) || count > 4096 || path.length > 4098)
    throw new Error('Architectural repetition exceeds its placement budget.')
  const put = (
    slot: InstancePart[],
    x: number,
    y: number,
    z: number,
    w: number,
    height: number,
    depth: number,
    turn = 0,
  ) => {
    if ([w, height, depth].some((n) => n <= 0)) return
    const p = at(x + length / 2)
    slot.push({
      center: [p.x - p.uz * z * side, system.elevation + y, p.z + p.ux * z * side],
      size: [w, height, depth],
      rotation: -Math.atan2(p.uz, p.ux) + turn,
      selection: { kind: 'architecture', id: system.id },
    })
  }
  const positions = Array.from(
    { length: count + (closed ? 0 : 1) },
    (_, i) => -length / 2 + (i * length) / count,
  )
  const span = (slot: InstancePart[], y: number, z: number, height: number, depth: number) => {
    const count = system.curve ? path.length - 1 : 1,
      width = length / count
    for (let i = 0; i < count; i++) put(slot, -length / 2 + (i + 0.5) * width, y, z, width, height, depth)
  }
  const cap = (y: number) => {
    if (!footprint) put(system.material === 'glass' ? glass : body, 0, y + t / 2, d / 2, length, t, d)
    if (footprint) {
      for (const ring of [footprint, ...holes])
        ring.forEach((a, i) => {
          const b = ring[(i + 1) % ring.length]
          edge.push({
            center: [(a.x + b.x) / 2, system.elevation + y + t / 2, (a.z + b.z) / 2],
            size: [Math.hypot(b.x - a.x, b.z - a.z), t, 0.035],
            rotation: -Math.atan2(b.z - a.z, b.x - a.x),
            selection: { kind: 'architecture', id: system.id },
          })
        })
      return
    }
    put(edge, 0, y + t / 2, d, length, t, 0.035)
    for (const x of [-length / 2, length / 2]) put(edge, x, y + t / 2, d / 2, 0.035, t, d)
  }
  const guard = (y: number, height = 1.1) => {
    const railT = Math.min(t, 0.065)
    const glazing = () => {
      if (system.material !== 'glass') return
      for (let i = 0; i < count; i++)
        put(
          glass,
          -length / 2 + ((i + 0.5) * length) / count,
          y + height / 2,
          d,
          Math.max(0.01, length / count - railT),
          Math.max(0.01, height - 0.16),
          0.012,
        )
    }
    if (system.curve && !system.footprint) {
      positions.forEach((x) => put(edge, x, y + height / 2, d, railT, height, railT))
      span(edge, y + height, d, railT, railT)
      glazing()
      if (!closed) for (const x of [-length / 2, length / 2]) put(edge, x, y + height, d / 2, railT, railT, d)
      return
    }
    if (footprint) {
      const posts = new Set<string>()
      const back = system.footprint ? 1 : path.length - 1
      footprint.slice(back).forEach((a, i) => {
        const b = footprint[(i + back + 1) % footprint.length],
          span = Math.hypot(b.x - a.x, b.z - a.z),
          n = Math.max(1, Math.ceil(span / system.spacing))
        if (!Number.isSafeInteger(n) || n > 4096 || posts.size + n > 16384)
          throw new Error('Architectural railing exceeds its placement budget.')
        edge.push({
          center: [(a.x + b.x) / 2, system.elevation + y + height, (a.z + b.z) / 2],
          size: [span, railT, railT],
          rotation: -Math.atan2(b.z - a.z, b.x - a.x),
          selection: { kind: 'architecture', id: system.id },
        })
        for (let j = 0; j <= n; j++) {
          const x = a.x + ((b.x - a.x) * j) / n,
            z = a.z + ((b.z - a.z) * j) / n,
            key = `${x.toFixed(6)}:${z.toFixed(6)}`
          if (posts.has(key)) continue
          posts.add(key)
          edge.push({
            center: [x, system.elevation + y + height / 2, z],
            size: [railT, height, railT],
            rotation: 0,
            selection: { kind: 'architecture', id: system.id },
          })
        }
      })
      return
    }
    positions.forEach((x) => put(edge, x, y + height / 2, d, railT, height, railT))
    glazing()
    put(edge, 0, y + height, d, length, railT, railT)
    for (const x of [-length / 2, length / 2]) put(edge, x, y + height, d / 2, railT, railT, d)
  }
  switch (system.profile) {
    case 'canopy':
      cap(h)
      break
    case 'balcony':
      cap(0)
      guard(t, h)
      break
    case 'veranda':
      cap(0)
      cap(h) // Railings require their own depicted spans, including entrance gaps.
      if (system.footprint)
        system.footprint.slice(2).forEach((p) =>
          columns.push({
            center: [p.x, system.elevation + h / 2, p.z],
            size: [t, h, t],
            rotation: 0,
            selection: { kind: 'architecture', id: system.id },
          }),
        )
      else
        for (const x of [-length / 2 + t / 2, length / 2 - t / 2]) put(columns, x, h / 2, d - t / 2, t, h, t)
      break
    case 'pergola':
      positions.forEach((x) => put(body, x, h, d / 2, t, t, d))
      for (const z of [t / 2, d - t / 2]) span(edge, h - t / 2, z, t, t)
      for (const x of [-length / 2 + t / 2, length / 2 - t / 2]) put(columns, x, h / 2, d - t / 2, t, h, t)
      break
    case 'fins': {
      const openings = articulationOpenings(system, level, false)
      positions
        .filter(
          (x) =>
            !openings.some(
              (o) =>
                x + t / 2 > o.left &&
                x - t / 2 < o.right &&
                system.elevation < o.top &&
                system.elevation + h > o.bottom,
            ),
        )
        .forEach((x) => put(body, x, h / 2, d / 2, t, h, d))
      break
    }
    case 'colonnade':
      positions.forEach((x) => put(columns, x, h / 2, 0, t, h, t))
      span(body, h + t / 2, 0, t, Math.max(t, d))
      break
    case 'railing':
      guard(0, h)
      break
    case 'portal':
      for (const x of [-length / 2 + t / 2, length / 2 - t / 2]) put(body, x, h / 2, d / 2, t, h, d)
      put(body, 0, h - t / 2, d / 2, length - 2 * t, t, d)
      break
    case 'cladding':
    case 'plinth': {
      const regions = subtractFacadeOpenings(
        { left: -length / 2, right: length / 2, bottom: system.elevation, top: system.elevation + h },
        articulationOpenings(system, level),
      )
      regions.forEach((r) => {
        const count = system.curve
          ? Math.max(1, Math.ceil((r.right - r.left) / (length / (path.length - 1))))
          : 1
        for (let i = 0; i < count; i++) {
          const w = (r.right - r.left) / count
          put(
            body,
            r.left + (i + 0.5) * w,
            (r.bottom + r.top) / 2 - system.elevation,
            d / 2,
            w,
            r.top - r.bottom,
            d,
          )
        }
      })
      break
    }
    case 'parapet':
    case 'cornice':
      span(body, h / 2, d / 2, h, d)
      break
    case 'arch':
      break // Indexed arch geometry is emitted by the surface writer.
  }
  return { body, edge, glass, columns }
}
