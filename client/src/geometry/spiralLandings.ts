import type { SpiralStairSystem } from '../domain/buildingSystems'
import type { Level } from '../domain/types'
export function spiralLandings(system: SpiralStairSystem, levels: Level[]) {
  const host = levels.find((l) => l.id === system.levelId),
    base = (host?.elevation || 0) + system.elevation,
    sign = system.clockwise ? 1 : -1
  return levels
    .filter((l) => l.elevation >= base - 0.001 && l.elevation <= base + system.height + 0.001)
    .map((level) => {
      const elevation = level.elevation - base,
        angle =
          ((system.landings?.find((l) => l.levelId === level.id)?.angle ??
            system.rotation + ((sign * elevation) / system.turnHeight) * 360) *
            Math.PI) /
          180
      const width = system.width,
        inner = system.radius - system.width,
        c = Math.cos(angle),
        s = Math.sin(angle)
      const polygon = [
        [inner, -width / 2],
        [system.radius, -width / 2],
        [system.radius, width / 2],
        [inner, width / 2],
      ].map(([r, t]) => ({ x: system.center.x + r * c - t * s, z: system.center.z + r * s + t * c }))
      return { levelId: level.id, elevation, angle, width, polygon }
    })
}
