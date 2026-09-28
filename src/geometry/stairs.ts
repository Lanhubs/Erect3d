import type { Level, Point, Stair } from '../domain/types'

export type Step = { u: number; v: number; height: number; width: number; depth: number; turn: number }
export type Landing = { u: number; v: number; height: number; sizeU: number; sizeV: number }
export function stairRise(stair: Stair, levels: Level[]) {
  const from = levels.find(level => level.id === stair.fromLevelId), to = levels.find(level => level.id === stair.toLevelId)
  return from && to ? to.elevation - from.elevation : 0
}
export function stairSteps(stair: Stair, levels: Level[]): Step[] {
  const rise = stairRise(stair, levels)
  if (rise <= .5 || stair.riserHeight < .1 || stair.treadDepth < .2 || stair.width < .6) return []
  const count = Math.max(2, Math.round(rise / stair.riserHeight)), riser = rise / count
  const split = Math.ceil(count / 2)
  return Array.from({ length: count }, (_, index) => {
    if (stair.form === 'straight' || index < split)
      return { u: (index + .5) * stair.treadDepth, v: 0, height: (index + 1) * riser,
        width: stair.width, depth: stair.treadDepth, turn: 0 }
    const second = index - split
    if (stair.form === 'L') return { u: split * stair.treadDepth + stair.landingLength,
      v: (second + .5) * stair.treadDepth, height: (index + 1) * riser,
      width: stair.width, depth: stair.treadDepth, turn: Math.PI / 2 }
    return { u: (split - second - .5) * stair.treadDepth, v: stair.width + stair.landingLength,
      height: (index + 1) * riser, width: stair.width, depth: stair.treadDepth, turn: Math.PI }
  })
}
export function localToWorld(stair: Stair, u: number, v: number): Point {
  const angle = stair.direction * Math.PI / 180
  return { x: stair.start.x + u * Math.cos(angle) - v * Math.sin(angle),
    z: stair.start.z + u * Math.sin(angle) + v * Math.cos(angle) }
}
export function stairLanding(stair: Stair, levels: Level[]): Landing | null {
  if (stair.form === 'straight') return null
  const steps = stairSteps(stair, levels)
  if (!steps.length) return null
  const split = Math.ceil(steps.length / 2), end = split * stair.treadDepth
  if (stair.form === 'L') return { u: end + (stair.landingLength + stair.width / 2) / 2, v: 0,
    height: steps[split - 1].height, sizeU: stair.landingLength + stair.width / 2, sizeV: stair.width }
  return { u: end - stair.width / 2, v: (stair.width + stair.landingLength) / 2,
    height: steps[split - 1].height, sizeU: stair.width + .25, sizeV: stair.width * 2 + stair.landingLength }
}
export function stairOpening(stair: Stair, levels: Level[]): Point[] {
  const steps = stairSteps(stair, levels)
  if (!steps.length) return []
  const cornersOf = (u: number, v: number, sizeU: number, sizeV: number) =>
    [-1, 1].flatMap(a => [-1, 1].map(b => localToWorld(stair, u + a * sizeU / 2, v + b * sizeV / 2)))
  const corners = steps.flatMap(step => {
    return cornersOf(step.u, step.v, step.turn === 0 || step.turn === Math.PI ? step.depth : step.width,
      step.turn === 0 || step.turn === Math.PI ? step.width : step.depth)
  })
  const landing = stairLanding(stair, levels)
  if (landing) corners.push(...cornersOf(landing.u, landing.v, landing.sizeU, landing.sizeV))
  const minX = Math.min(...corners.map(point => point.x)) - .12, maxX = Math.max(...corners.map(point => point.x)) + .12
  const minZ = Math.min(...corners.map(point => point.z)) - .12, maxZ = Math.max(...corners.map(point => point.z)) + .12
  return [{ x: minX, z: minZ }, { x: maxX, z: minZ }, { x: maxX, z: maxZ }, { x: minX, z: maxZ }]
}
export function stairHeightAt(stair: Stair, levels: Level[], point: Point): number | null {
  const steps = stairSteps(stair, levels)
  const angle = stair.direction * Math.PI / 180
  const dx = point.x - stair.start.x, dz = point.z - stair.start.z
  const u = dx * Math.cos(angle) + dz * Math.sin(angle), v = -dx * Math.sin(angle) + dz * Math.cos(angle)
  for (const step of steps) {
    const along = step.turn === 0 || step.turn === Math.PI ? step.depth / 2 : step.width / 2
    const across = step.turn === 0 || step.turn === Math.PI ? step.width / 2 : step.depth / 2
    if (Math.abs(u - step.u) <= along && Math.abs(v - step.v) <= across) return step.height
  }
  const landing = stairLanding(stair, levels)
  if (landing && Math.abs(u - landing.u) <= landing.sizeU / 2 && Math.abs(v - landing.v) <= landing.sizeV / 2)
    return landing.height
  return null
}
