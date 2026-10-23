import { facadeParts } from './facadeSystem'
import { facadePath } from './facadeSystem'
export { facadePath } from './facadeSystem'
export { levelWithSystemVoids } from './systemVoidSlabs'
import type { Building, Level } from '../domain/types'
import type { BuildingSystem } from '../domain/buildingSystems'
import { systemPoints, validateSystems } from '../domain/systemValidation'
import type { InstancePart } from '../rendering/EntityInstances'
import { articulationPath } from './articulationPath'
import { articulationParts } from './articulationCompiler'
import { spiralStairPlan } from './spiralStair'
import { spiralLandings } from './spiralLandings'
export type SystemPackage = {
  id: string
  system: BuildingSystem
  parts: InstancePart[]
  glass: InstancePart[]
  frame: InstancePart[]
  articulation?: ReturnType<typeof articulationParts>
  spiral?: ReturnType<typeof spiralStairPlan>
}
export function compileSystem(
  system: BuildingSystem,
  level?: Level,
  slice?: { bottom: number; top: number },
  levels: Level[] = [],
): SystemPackage {
  const parts: InstancePart[] = [],
    glass: InstancePart[] = [],
    frame: InstancePart[] = [],
    selection = { kind: 'architecture' as const, id: system.id }
  const line = (
    a: { x: number; z: number },
    b: { x: number; z: number },
    bottom: number,
    height: number,
    depth: number,
  ): InstancePart => ({
    center: [(a.x + b.x) / 2, bottom + height / 2, (a.z + b.z) / 2],
    size: [Math.hypot(b.x - a.x, b.z - a.z), height, depth],
    rotation: -Math.atan2(b.z - a.z, b.x - a.x),
    selection,
  })
  if (system.kind === 'core' || system.kind === 'shaft') {
    if (system.wallIds?.length && level)
      for (const wall of level.walls.filter((w) => system.wallIds!.includes(w.id))) {
        const bottom = Math.max(wall.height, system.elevation),
          top = system.elevation + system.height
        if (top > bottom + 0.001) {
          const path = facadePath({ path: [wall.start, wall.end], curve: wall.curve })
          path
            .slice(1)
            .forEach((point, i) => parts.push(line(path[i], point, bottom, top - bottom, wall.thickness)))
        }
      }
    else
      system.polygon.forEach((a, i) =>
        parts.push(
          line(
            a,
            system.polygon[(i + 1) % system.polygon.length],
            system.elevation,
            system.height,
            system.thickness,
          ),
        ),
      )
  }
  if (system.kind === 'beam')
    parts.push(line(system.start, system.end, system.elevation, system.height, system.width))
  if (system.kind === 'curtain-wall') {
    const facade = facadeParts(system, level)
    glass.push(...facade.glass)
    frame.push(...facade.frame)
  }
  return {
    id: system.id,
    system,
    parts,
    glass,
    frame,
    ...(system.kind === 'articulation'
      ? { articulation: articulationParts(system, level) }
      : system.kind === 'spiral-stair'
        ? { spiral: spiralStairPlan(system, slice, levels) }
        : {}),
  }
}
export function compileBuildingSystems(building: Building) {
  const errors = validateSystems(building)
  if (errors.length) return { errors, packages: [] as SystemPackage[] }
  try {
    return {
      errors,
      packages: (building.systems?.systems || []).map((system) =>
        compileSystem(
          system,
          building.levels.find((l) => l.id === system.levelId),
          undefined,
          building.levels,
        ),
      ),
    }
  } catch (error) {
    return { errors: [String(error)], packages: [] as SystemPackage[] }
  }
}
export function architecturalBounds(building: Building) {
  let top = 0
  const points = [] as { x: number; z: number }[]
  for (const system of building.systems?.systems || []) {
    if (system.visible === false) continue
    if (system.kind === 'spiral-stair')
      points.push(...spiralLandings(system, building.levels).flatMap((l) => l.polygon))
    const base = (building.levels.find((l) => l.id === system.levelId)?.elevation || 0) + system.elevation
    if (system.kind === 'typical-floors') {
      const template = building.levels.find((l) => l.id === system.templateLevelId)
      if (template) points.push(...template.walls.flatMap((w) => [w.start, w.end]))
      top = Math.max(top, base + system.count * system.floorHeight)
    } else {
      points.push(
        ...(system.kind === 'spiral-stair'
          ? Array.from({ length: 32 }, (_, i) => ({
              x: system.center.x + Math.cos((i * Math.PI) / 16) * system.radius,
              z: system.center.z + Math.sin((i * Math.PI) / 16) * system.radius,
            }))
          : system.kind === 'curtain-wall'
            ? facadePath(system)
            : system.kind === 'articulation'
              ? articulationPath(system).footprint || articulationPath(system).path
              : systemPoints(system)),
      )
      top = Math.max(top, base + system.height + (system.kind === 'spiral-stair' ? 1.05 : 0))
    }
  }
  return { top, points }
}
