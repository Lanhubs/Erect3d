import type { Level, Point, Slab, Stair } from '../domain/types'
import { containsPolygon } from './polygons'
import { buildColliders, collidesPrepared } from './walls'
import { localToWorld, stairLanding, stairOpening, stairSteps } from './stairs'

function bounds(points: Point[]) {
  return { minX: Math.min(...points.map(point => point.x)), maxX: Math.max(...points.map(point => point.x)),
    minZ: Math.min(...points.map(point => point.z)), maxZ: Math.max(...points.map(point => point.z)) }
}
export function findStairPlacement(stair: Stair, levels: Level[], upperSlabs: Slab[]): Stair | null {
  const from = levels.find(level => level.id === stair.fromLevelId)
  if (!from || !upperSlabs.length) return null
  const colliders = buildColliders(from.walls, from.doors, from.windows, undefined, from.passages)
  const areas = from.rooms.map(room => ({ polygon: room.polygon, area: Math.abs(room.polygon.reduce((sum, point, index) => {
    const next = room.polygon[(index + 1) % room.polygon.length]
    return sum + point.x * next.z - next.x * point.z
  }, 0)) / 2 })).sort((a, b) => b.area - a.area)
  const all = from.walls.flatMap(wall => [wall.start, wall.end])
  if (all.length) areas.push({ polygon: all, area: 0 })
  for (const area of areas) {
    const box = bounds(area.polygon)
    for (const direction of [0, 90, 180, 270]) {
      for (let x = box.minX + 1; x <= box.maxX - 1; x += .5) {
        for (let z = box.minZ + 1; z <= box.maxZ - 1; z += .5) {
          const candidate = { ...stair, start: { x, z }, direction }
          const opening = stairOpening(candidate, levels)
          if (!upperSlabs.some(slab => containsPolygon(slab.polygon, opening))) continue
          const steps = stairSteps(candidate, levels)
          const landing = stairLanding(candidate, levels)
          const route = [...steps.map(step => localToWorld(candidate, step.u, step.v)),
            ...(landing ? [localToWorld(candidate, landing.u, landing.v)] : [])]
          if (route.every(point => !collidesPrepared(point, candidate.width / 2 + .08, colliders))) return candidate
        }
      }
    }
  }
  return null
}
