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
    if (stair.form === 'L') return { u: split * stair.treadDepth + stair.width / 2,
      v: stair.width / 2 + (second + .5) * stair.treadDepth, height: (index + 1) * riser,
      width: stair.width, depth: stair.treadDepth, turn: Math.PI / 2 }
    return { u: split * stair.treadDepth + stair.landingLength - (second + .5) * stair.treadDepth, v: stair.width + stair.landingLength,
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
  if (stair.form === 'L') return { u: end + stair.width / 2, v: 0,
    height: steps[split - 1].height, sizeU: stair.width, sizeV: stair.width }
  return { u: end + stair.landingLength / 2, v: (stair.width + stair.landingLength) / 2,
    height: steps[split - 1].height, sizeU: stair.landingLength, sizeV: stair.width * 2 + stair.landingLength }
}
// A return flight finishes inside its shared rectangular well. The upper landing bridges to the slab edge.
export function stairExitLanding(stair: Stair, levels: Level[]): Landing | null {
  if (stair.form !== 'U') return null
  const steps = stairSteps(stair, levels), last = steps.at(-1)
  if (!last) return null
  const end = last.u - last.depth / 2, start = -.14
  return { u: (start + end) / 2, v: last.v, height: last.height, sizeU: end - start + .02, sizeV: stair.width }
}
export function stairOpening(stair: Stair, levels: Level[]): Point[] {
  const steps = stairSteps(stair, levels)
  if (!steps.length) return []
  const corners: [number, number][] = steps.flatMap(step => {
    const sizeU = step.turn === Math.PI / 2 ? step.width : step.depth
    const sizeV = step.turn === Math.PI / 2 ? step.depth : step.width
    return [-1, 1].flatMap(a => [-1, 1].map(b => [step.u + a * sizeU / 2, step.v + b * sizeV / 2] as [number, number]))
  })
  const landing = stairLanding(stair, levels)
  if (landing) corners.push(...[-1, 1].flatMap(a => [-1, 1].map(b =>
    [landing.u + a * landing.sizeU / 2, landing.v + b * landing.sizeV / 2] as [number, number])))
  const minU = Math.min(...corners.map(point => point[0])) - .12, maxU = Math.max(...corners.map(point => point[0])) + .12
  const minV = Math.min(...corners.map(point => point[1])) - .12, maxV = Math.max(...corners.map(point => point[1])) + .12
  return [[minU, minV], [maxU, minV], [maxU, maxV], [minU, maxV]].map(([u, v]) => localToWorld(stair, u, v))
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
