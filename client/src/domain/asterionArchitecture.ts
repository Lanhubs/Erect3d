import type { ArticulationSystem, BuildingSystem, TypicalFloorGroup } from './buildingSystems'
import { uid, type Level, type Point, type RoofSection } from './types'
import { rectangle } from './asterionLayouts'

const base = (level: Level, name: string) => ({
  id: uid('system'),
  name,
  levelId: level.id,
  origin: 'user-selected' as const,
  evidence: 'Authored Asterion Tower showcase',
  elevation: 0,
  color: '#667b83',
})
export function towerFloors(level: Level, count: number, name: string): TypicalFloorGroup {
  return {
    ...base(level, name),
    kind: 'typical-floors',
    templateLevelId: level.id,
    count,
    floorHeight: 3.6,
    detached: {},
  }
}
export function towerFacade(level: Level, ring: Point[], height: number, hostWalls = true): BuildingSystem {
  return {
    ...base(level, `${level.name} · unitized glazing`),
    kind: 'curtain-wall',
    path: [...ring, ring[0]],
    height,
    wallIds: hostWalls ? level.walls.slice(0, ring.length).map((wall) => wall.id) : [],
    bayWidth: 1.5,
    transomHeight: level.floorToFloorHeight!,
    depth: 0.16,
    color: '#50636c',
  }
}
export function towerDetail(
  level: Level,
  name: string,
  profile: ArticulationSystem['profile'],
  a: Point,
  b: Point,
  height: number,
  elevation = 0,
  depth = 0.3,
  spacing = 1.5,
): ArticulationSystem {
  return {
    ...base(level, name),
    kind: 'articulation',
    profile,
    material: 'metal',
    path: [a, b],
    height,
    elevation,
    depth,
    spacing,
    thickness: 0.12,
    side: 'right',
    color: '#c0b7a4',
  }
}
export function perimeterDetails(
  level: Level,
  ring: Point[],
  profile: ArticulationSystem['profile'],
  height: number,
  elevation: number,
  repeat = false,
) {
  return ring.map((a, i) => ({
    ...towerDetail(
      level,
      `${level.name} · ${profile} ${i + 1}`,
      profile,
      a,
      ring[(i + 1) % ring.length],
      height,
      elevation,
      0.25,
      2.4,
    ),
    repeatWithFloor: repeat,
  }))
}
export function terraceGuards(level: Level, ring: Point[]) {
  return perimeterDetails(level, ring, 'railing', 1.1, 0.08).map((detail) => ({
    ...detail,
    material: 'glass' as const,
    depth: 0.06,
    thickness: 0.045,
    color: '#82969c',
  }))
}
export function towerRoof(
  level: Level,
  name: string,
  footprint: Point[],
  height: number,
  voids: Point[][] = [],
): RoofSection {
  return {
    id: uid('roof'),
    levelId: level.id,
    name,
    footprint: structuredClone(footprint),
    voids: structuredClone(voids),
    topHeight: height,
    automatic: false,
    followFootprint: false,
    roof: {
      shape: 'terrace',
      material: 'membrane',
      color: '#b5b6b0',
      pitch: 0,
      overhang: 0,
      fasciaDepth: 0.2,
    },
  }
}
export function towerCrown(level: Level): BuildingSystem[] {
  const ring = rectangle(-7, -6, 7, 6),
    height = 7.2,
    elevation = 5.4
  return [
    {
      ...base(level, 'Screened rooftop plant'),
      kind: 'massing',
      role: 'mechanical',
      polygon: rectangle(-5, -4, 5, 4),
      holes: [],
      height: 4,
      elevation,
      color: '#7c8588',
    },
    ...ring.map((a, i) =>
      towerDetail(
        level,
        `Crown · vertical blade screen ${i + 1}`,
        'fins',
        a,
        ring[(i + 1) % 4],
        height,
        elevation,
        0.55,
        0.8,
      ),
    ),
    ...perimeterDetails(level, ring, 'cornice', 0.25, elevation + height),
  ]
}
