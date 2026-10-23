import type { Level, SiteFence } from '../domain/types'
import { wallSolids, siteFenceColliders } from '../geometry/walls'
import { atWall, wallSubpath } from '../geometry/math'
import { blocksWalking } from '../furniture/entities'
import { verandaGeometry } from '../geometry/veranda'
import { boundsOf, SpatialIndex } from './spatial'
import { playerShape, type Obstacle } from './types'
import type { BuildingSystem } from '../domain/buildingSystems'
import { spiralStairPlan } from '../geometry/spiralStair'
export function buildWalkObstacles(
  levels: Level[],
  openDoors: ReadonlySet<string>,
  fence?: SiteFence,
  furnitureShown = true,
  systems: BuildingSystem[] = [],
) {
  const obstacles: Obstacle[] = []
  const segment = (a: Obstacle['a'], b: Obstacle['a'], radius: number, bottom: number, top: number) =>
    obstacles.push({ ...boundsOf([a, b], radius), kind: 'segment', a, b, radius, bottom, top })
  const box = (
    a: Obstacle['a'],
    width: number,
    depth: number,
    angle: number,
    bottom: number,
    top: number,
  ) => {
    const radius = Math.hypot(width, depth) / 2
    obstacles.push({
      ...boundsOf([a], radius),
      kind: 'box',
      a,
      width,
      depth,
      angle: (angle * Math.PI) / 180,
      bottom,
      top,
    })
  }
  for (const level of levels) {
    const base = level.elevation
    for (const wall of level.walls)
      for (const solid of wallSolids(wall, level.doors, level.windows, level.passages)) {
        const path = wallSubpath(wall, solid.start, solid.end)
        for (let i = 1; i < path.length; i++)
          segment(path[i - 1], path[i], wall.thickness / 2, base + solid.bottom, base + solid.top)
      }
    for (const door of level.doors)
      if (!openDoors.has(door.id)) {
        const wall = level.walls.find((item) => item.id === door.wallId)
        if (wall)
          segment(
            atWall(wall, door.offset),
            atWall(wall, door.offset + door.width),
            0.025,
            base,
            base + door.height,
          )
      }
    for (const column of level.columns || []) {
      if (column.shape === 'circular')
        obstacles.push({
          ...boundsOf([column.position], column.diameter / 2),
          kind: 'circle',
          a: column.position,
          radius: column.diameter / 2,
          bottom: base,
          top: base + column.height,
        })
      else box(column.position, column.width, column.depth, column.rotation || 0, base, base + column.height)
    }
    if (furnitureShown)
      for (const object of level.furniture || [])
        if (blocksWalking(object.type))
          box(object.position, object.width, object.depth, object.rotation, base, base + object.height)
    for (const door of level.doors)
      if (door.veranda?.railing)
        for (const [a, b] of verandaGeometry(level, door)?.rails || []) segment(a, b, 0.035, base, base + 1.1)
    for (const detail of level.details || [])
      if (['railing', 'screen', 'parapet'].includes(detail.kind))
        segment(
          detail.start,
          detail.end,
          detail.depth / 2,
          base + detail.baseElevation,
          base + detail.baseElevation + detail.height,
        )
  }
  for (const system of systems)
    if (system.kind === 'spiral-stair' && system.visible !== false) {
      const level = levels.find((l) => l.id === system.levelId)
      if (!level) continue
      const base = level.elevation + system.elevation,
        inner = system.radius - system.width
      obstacles.push({
        ...boundsOf([system.center], inner),
        kind: 'circle',
        a: system.center,
        radius: inner,
        bottom: base,
        top: base + system.height + 1.05,
      })
      const plan = spiralStairPlan(system, undefined, levels)
      for (const rail of plan.rails) {
        const horizontal = (rail.size[0] * Math.cos(rail.slope || 0)) / 2,
          dx = Math.cos(rail.rotation) * horizontal,
          dz = -Math.sin(rail.rotation) * horizontal,
          dy = (Math.sin(rail.slope || 0) * rail.size[0]) / 2
        segment(
          { x: rail.center[0] - dx, z: rail.center[2] - dz },
          { x: rail.center[0] + dx, z: rail.center[2] + dz },
          0.025,
          level.elevation + rail.center[1] - Math.abs(dy) - 1.05,
          level.elevation + rail.center[1] + Math.abs(dy) + 0.025,
        )
      }
    }
  for (const collider of siteFenceColliders(fence)) {
    const base = Math.min(...levels.map((level) => level.elevation), 0)
    segment(collider.a, collider.b, collider.halfWidth, base, base + (fence?.height || 1.8))
  }
  return new SpatialIndex(obstacles)
}
export function obstacleHits(
  obstacle: Obstacle,
  x: number,
  z: number,
  foot: number,
  radius = playerShape.radius,
) {
  if (foot + playerShape.height <= obstacle.bottom + 0.015 || foot >= obstacle.top - 0.015) return false
  let dx = x - obstacle.a.x,
    dz = z - obstacle.a.z
  if (obstacle.kind === 'circle') return Math.hypot(dx, dz) < radius + obstacle.radius!
  if (obstacle.kind === 'box') {
    const c = Math.cos(obstacle.angle!),
      s = Math.sin(obstacle.angle!),
      u = dx * c + dz * s,
      v = -dx * s + dz * c
    return (
      Math.hypot(
        Math.max(0, Math.abs(u) - obstacle.width! / 2),
        Math.max(0, Math.abs(v) - obstacle.depth! / 2),
      ) < radius
    )
  }
  const ax = obstacle.b!.x - obstacle.a.x,
    az = obstacle.b!.z - obstacle.a.z
  const t = Math.max(0, Math.min(1, (dx * ax + dz * az) / Math.max(0.00001, ax * ax + az * az)))
  dx -= t * ax
  dz -= t * az
  return Math.hypot(dx, dz) < radius + obstacle.radius!
}
export const blockedAt = (index: SpatialIndex<Obstacle>, x: number, z: number, foot: number) =>
  index.query(x, z, playerShape.radius).some((item) => obstacleHits(item, x, z, foot))
