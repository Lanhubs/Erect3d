import type { SpiralStairSystem } from '../domain/buildingSystems'
import type { InstancePart } from '../rendering/EntityInstances'
import { systemMassGeometry } from './systemMass'
import type { Level } from '../domain/types'
import { spiralLandings } from './spiralLandings'
export function spiralStairPlan(
  system: SpiralStairSystem,
  slice?: { bottom: number; top: number },
  levels: Level[] = [],
) {
  const count = Math.ceil(system.height / system.riserHeight),
    rise = system.height / count,
    sign = system.clockwise ? 1 : -1
  if (
    !Number.isSafeInteger(count) ||
    count < 1 ||
    count > 30000 ||
    system.radius <= system.width ||
    system.width <= 0 ||
    system.turnHeight <= 0
  )
    throw new Error('Invalid spiral stair flight or tread allocation.')
  const angle = (sign * 2 * Math.PI * rise) / system.turnHeight,
    thickness = Math.min(0.08, rise * 0.45),
    inner = system.radius - system.width
  const steps: InstancePart[] = [],
    posts: InstancePart[] = [],
    rails: InstancePart[] = [],
    platforms: InstancePart[] = [],
    selection = { kind: 'architecture' as const, id: system.id },
    landings = spiralLandings(system, levels)
  const gap = (i: number) =>
    landings.some(
      (l) =>
        Math.abs(i * rise - l.elevation) < rise * 2 &&
        Math.abs(
          Math.atan2(
            Math.sin((system.rotation * Math.PI) / 180 + i * angle - l.angle),
            Math.cos((system.rotation * Math.PI) / 180 + i * angle - l.angle),
          ),
        ) <
          l.width / (2 * system.radius) + Math.abs(angle) / 2,
    )
  const at = (i: number) => {
    const a = (system.rotation * Math.PI) / 180 + i * angle
    return {
      x: system.center.x + (system.radius - 0.025) * Math.cos(a),
      z: system.center.z + (system.radius - 0.025) * Math.sin(a),
      y: system.elevation + i * rise,
    }
  }
  for (let i = 0; i < count; i++) {
    if (slice && ((i + 1) * rise < slice.bottom || i * rise > slice.top)) continue
    steps.push({
      center: [system.center.x, system.elevation + (i + 1) * rise - thickness, system.center.z],
      size: [1, 1, 1],
      rotation: -((system.rotation * Math.PI) / 180 + i * angle),
      selection,
    })
    const a = at(i + 1),
      b = at(Math.min(count, i + 2)),
      dx = b.x - a.x,
      dz = b.z - a.z,
      dy = b.y - a.y,
      horizontal = Math.hypot(dx, dz)
    if (!gap(i + 1))
      posts.push({ center: [a.x, a.y + 0.525, a.z], size: [0.035, 1.05, 0.035], rotation: 0, selection })
    if (horizontal > 0.001 && !gap(i + 1) && !gap(i + 2))
      rails.push({
        center: [(a.x + b.x) / 2, (a.y + b.y) / 2 + 1.05, (a.z + b.z) / 2],
        size: [Math.hypot(horizontal, dy), 0.045, 0.045],
        rotation: -Math.atan2(dz, dx),
        slope: Math.atan2(dy, horizontal),
        selection,
      })
  }
  for (const landing of landings) {
    if (slice && (landing.elevation < slice.bottom - 0.001 || landing.elevation > slice.top + 0.001)) continue
    const r = (inner + system.radius) / 2
    platforms.push({
      center: [
        system.center.x + r * Math.cos(landing.angle),
        system.elevation + landing.elevation - 0.05,
        system.center.z + r * Math.sin(landing.angle),
      ],
      size: [system.width, 0.1, landing.width],
      rotation: -landing.angle,
      selection,
    })
  }
  const bottom = slice?.bottom || 0,
    top = Math.min(system.height, slice?.top ?? system.height) + 1.05
  const pole: InstancePart = {
    center: [system.center.x, system.elevation + (top + bottom) / 2, system.center.z],
    size: [inner * 2, top - bottom, inner * 2],
    rotation: 0,
    selection,
  }
  return { steps, posts, rails, platforms, pole, count, rise, angle, thickness }
}
export function spiralTreadGeometry(system: SpiralStairSystem, angle: number, thickness: number) {
  const inner = system.radius - system.width,
    segments = Math.max(2, Math.ceil(Math.abs(angle) / 0.06)),
    polygon = [] as { x: number; z: number }[]
  for (let i = 0; i <= segments; i++) {
    const a = (angle * i) / segments
    polygon.push({ x: system.radius * Math.cos(a), z: system.radius * Math.sin(a) })
  }
  for (let i = segments; i >= 0; i--) {
    const a = (angle * i) / segments
    polygon.push({ x: inner * Math.cos(a), z: inner * Math.sin(a) })
  }
  return systemMassGeometry({
    ...system,
    kind: 'massing',
    role: 'wing',
    polygon,
    holes: [],
    height: thickness,
    elevation: 0,
  })
}
