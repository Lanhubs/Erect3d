import type { Level, Point } from '../domain/types'
import { containsPoint } from '../geometry/polygons'
import { verandaGeometry } from '../geometry/veranda'
import { boundsOf, SpatialIndex } from './spatial'
import { slopeSurface, walkStairSurfaces } from './stairSurfaces'
import { playerShape, type Surface } from './types'
import type { BuildingSystem } from '../domain/buildingSystems'
import { spiralSurfaces } from './spiralSurfaces'
export function buildWalkSurfaces(levels: Level[], systems: BuildingSystem[] = []) {
  const surfaces: Surface[] = [],
    ceilings: Surface[] = []
  const flat = (polygon: Point[], holes: Point[][], height: number, levelId: string): Surface => ({
    ...boundsOf(polygon),
    levelId,
    heightAt: (p) =>
      containsPoint(polygon, p) && !holes.some((hole) => containsPoint(hole, p)) ? height : null,
  })
  for (const level of levels) {
    for (const slab of level.slabs || []) {
      const holes = slab.openings.map((opening) => opening.polygon),
        top = level.elevation + slab.elevation
      surfaces.push(flat(slab.polygon, holes, top, level.id))
      ceilings.push(flat(slab.polygon, holes, top - slab.thickness, level.id))
    }
    if (!level.slabs?.length)
      for (const room of level.rooms) surfaces.push(flat(room.polygon, [], level.elevation, level.id))
    for (const door of level.doors) {
      const veranda = verandaGeometry(level, door)
      if (veranda) surfaces.push(flat(veranda.polygon, [], level.elevation, level.id))
    }
    for (const stair of level.stairs || []) surfaces.push(...walkStairSurfaces(stair, levels))
    for (const ramp of level.ramps || [])
      surfaces.push(
        slopeSurface(
          ramp.start,
          ramp.end,
          ramp.width,
          level.elevation + ramp.startElevation,
          level.elevation + ramp.endElevation,
          level.id,
        ),
      )
  }
  for (const system of systems)
    if (system.kind === 'spiral-stair' && system.visible !== false) {
      const level = levels.find((l) => l.id === system.levelId)
      if (level) {
        const flight = spiralSurfaces(system, level.elevation, levels)
        surfaces.push(...flight.floors)
        ceilings.push(...flight.ceilings)
      }
    }
  return {
    floors: new SpatialIndex(surfaces, 4),
    ceilings: new SpatialIndex(ceilings, 4),
    base: Math.min(...levels.map((l) => l.elevation), 0),
  }
}
export type GroundWorld = ReturnType<typeof buildWalkSurfaces>
export function floorAt(world: GroundWorld, x: number, z: number, foot: number) {
  let floor = world.base
  for (const surface of world.floors.query(x, z, 0)) {
    const height = surface.heightAt({ x, z })
    if (height !== null && height <= foot + playerShape.step && height > floor) floor = height
  }
  return floor
}
export function headBlocked(world: GroundWorld, x: number, z: number, foot: number) {
  return world.ceilings.query(x, z, playerShape.radius).some((surface) => {
    const y = surface.heightAt({ x, z })
    return y !== null && y > foot + 0.05 && y < foot + playerShape.height - 0.015
  })
}
