import type { Level, Point, Stair } from '../domain/types'
import { localToWorld, stairLanding, stairSteps, stairExitLanding } from '../geometry/stairs'
import { boundsOf } from './spatial'
import type { Surface } from './types'
export function slopeSurface(
  a: Point,
  b: Point,
  width: number,
  from: number,
  to: number,
  levelId: string,
  padding = 0.15,
): Surface {
  const dx = b.x - a.x,
    dz = b.z - a.z,
    length = Math.hypot(dx, dz) || 1
  return {
    ...boundsOf([a, b], width / 2 + padding),
    levelId,
    transition: true,
    heightAt: (point) => {
      const u = ((point.x - a.x) * dx + (point.z - a.z) * dz) / length,
        v = (-(point.x - a.x) * dz + (point.z - a.z) * dx) / length
      return u >= -padding && u <= length + padding && Math.abs(v) <= width / 2
        ? from + (to - from) * Math.max(0, Math.min(1, u / length))
        : null
    },
  }
}
export function walkStairSurfaces(stair: Stair, levels: Level[]): Surface[] {
  const steps = stairSteps(stair, levels),
    base = levels.find((level) => level.id === stair.fromLevelId)?.elevation || 0
  if (!steps.length) return []
  const split = stair.form === 'straight' ? steps.length : Math.ceil(steps.length / 2),
    firstRise = steps[split - 1].height
  const firstEnd = split * stair.treadDepth
  const surfaces = [
    slopeSurface(
      stair.start,
      localToWorld(stair, firstEnd, 0),
      stair.width,
      base,
      base + firstRise,
      stair.fromLevelId,
    ),
  ]
  const landing = stairLanding(stair, levels)
  if (!landing) return surfaces
  const polygon = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([a, b]) =>
    localToWorld(stair, landing.u + (a * landing.sizeU) / 2, landing.v + (b * landing.sizeV) / 2),
  )
  const angle = (stair.direction * Math.PI) / 180
  surfaces.push({
    ...boundsOf(polygon),
    levelId: stair.fromLevelId,
    transition: true,
    heightAt: (point) => {
      const dx = point.x - stair.start.x,
        dz = point.z - stair.start.z,
        u = dx * Math.cos(angle) + dz * Math.sin(angle),
        v = -dx * Math.sin(angle) + dz * Math.cos(angle)
      return Math.abs(u - landing.u) <= landing.sizeU / 2 && Math.abs(v - landing.v) <= landing.sizeV / 2
        ? base + landing.height
        : null
    },
  })
  const secondStart =
    stair.form === 'L'
      ? localToWorld(stair, firstEnd + stair.width / 2, stair.width / 2)
      : localToWorld(stair, firstEnd + stair.landingLength, stair.width + stair.landingLength)
  const secondEnd =
    stair.form === 'L'
      ? localToWorld(
          stair,
          firstEnd + stair.width / 2,
          stair.width / 2 + (steps.length - split) * stair.treadDepth,
        )
      : localToWorld(
          stair,
          firstEnd + stair.landingLength - (steps.length - split) * stair.treadDepth,
          stair.width + stair.landingLength,
        )
  surfaces.push(
    slopeSurface(
      secondStart,
      secondEnd,
      stair.width,
      base + firstRise,
      base + steps.at(-1)!.height,
      stair.fromLevelId,
    ),
  )
  const exit = stairExitLanding(stair, levels)
  if (exit) {
    const a = localToWorld(stair, exit.u - exit.sizeU / 2, exit.v),
      b = localToWorld(stair, exit.u + exit.sizeU / 2, exit.v)
    surfaces.push(slopeSurface(a, b, exit.sizeV, base + exit.height, base + exit.height, stair.toLevelId, 0))
  }
  return surfaces
}
