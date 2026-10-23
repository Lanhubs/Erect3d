import type { SpiralStairSystem } from '../domain/buildingSystems'
import type { Surface } from './types'
import type { Level } from '../domain/types'
import { spiralLandings } from '../geometry/spiralLandings'
import { containsPoint } from '../geometry/polygons'
import { boundsOf } from './spatial'
export function spiralSurfaces(system: SpiralStairSystem, base: number, levels: Level[] = []) {
  const r = system.radius,
    inner = r - system.width,
    count = Math.ceil(system.height / system.riserHeight),
    rise = system.height / count,
    sign = system.clockwise ? 1 : -1
  const turnCount = Math.ceil(system.height / system.turnHeight),
    start = (system.rotation * Math.PI) / 180,
    bottom = base + system.elevation
  const bounds = {
    minX: system.center.x - r,
    maxX: system.center.x + r,
    minZ: system.center.z - r,
    maxZ: system.center.z + r,
    levelId: system.levelId,
    transition: true,
  }
  const phase = (p: { x: number; z: number }) => {
    const dx = p.x - system.center.x,
      dz = p.z - system.center.z,
      radius = Math.hypot(dx, dz)
    return radius < inner || radius > r
      ? null
      : ((((Math.atan2(dz, dx) - start) * sign) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
  }
  const surfaces: Surface[] = Array.from({ length: turnCount }, (_, turn) => ({
    ...bounds,
    heightAt: (p) => {
      const angle = phase(p)
      if (angle === null) return null
      const progress = (turn + angle / (2 * Math.PI)) * system.turnHeight
      return progress > system.height + 1e-8
        ? null
        : bottom + Math.min(system.height, (Math.floor(progress / rise + 1e-8) + 1) * rise)
    },
  }))
  const end = ((system.height / system.turnHeight) * 2 * Math.PI) % (2 * Math.PI)
  surfaces.push({
    ...bounds,
    heightAt: (p) => {
      const angle = phase(p)
      return angle !== null && Math.abs(angle - end) < 1e-7 ? bottom + system.height : null
    },
  })
  for (const landing of spiralLandings(system, levels))
    surfaces.push({
      ...boundsOf(landing.polygon),
      levelId: landing.levelId,
      transition: true,
      heightAt: (p) => (containsPoint(landing.polygon, p) ? bottom + landing.elevation : null),
    })
  return {
    floors: surfaces,
    ceilings: surfaces.map((surface) => ({
      ...surface,
      heightAt: (p: { x: number; z: number }) => {
        const y = surface.heightAt(p)
        return y === null ? null : y - Math.min(0.08, rise * 0.45)
      },
    })),
  }
}
