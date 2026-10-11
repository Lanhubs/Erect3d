import { defaultRoof, type Building, type Level, type Point, type Slab } from '../domain/types'
import { roomArea, wallLength } from './math'
import { roofSurfaceArea } from './roofQuantity'
import { roofRegions } from './roofRegions'
import { verandaGeometry, verandaCover } from './veranda'
import { effectiveRoofSections } from '../domain/roofCoverage'
export function polygonArea(polygon: Point[]) {
  if (polygon.length < 3) return 0
  return Math.abs(polygon.reduce((sum, point, index) => {
    const next = polygon[(index + 1) % polygon.length]
    return sum + point.x * next.z - next.x * point.z
  }, 0)) / 2
}
export function slabArea(slab: Slab) {
  return Math.max(0, polygonArea(slab.polygon) - slab.openings.reduce((sum, opening) => sum + polygonArea(opening.polygon), 0))
}

export function levelQuantities(level: Level) {
  const wallLengthTotal = level.walls.reduce((sum, wall) => sum + wallLength(wall), 0)
  const grossWallArea = level.walls.reduce((sum, wall) => sum + wallLength(wall) * wall.height * 2, 0)
  const openingsArea = level.doors.reduce((sum, door) => sum + door.width * door.height * 2, 0) +
    level.windows.reduce((sum, window) => sum + window.width * window.height * 2, 0)
  const floorArea = level.rooms.reduce((sum, room) => sum + roomArea(room), 0)
  const slabs = [...(level.slabs || []), ...level.doors.flatMap(door => { const veranda = verandaGeometry(level, door); return veranda ? [veranda.slab] : [] })]
  const slabAreaTotal = slabs.reduce((sum, slab) => sum + slabArea(slab), 0)
  const slabByMaterial = new Map<string, number>(), slabFinishByMaterial = new Map<string, number>()
  for (const slab of slabs) {
    const area = slabArea(slab)
    slabByMaterial.set(slab.structuralMaterial, (slabByMaterial.get(slab.structuralMaterial) || 0) + area)
    slabFinishByMaterial.set(slab.finishMaterial, (slabFinishByMaterial.get(slab.finishMaterial) || 0) + area)
  }
  const finishes = new Map<string, number>()
  for (const room of level.rooms) finishes.set(room.material, (finishes.get(room.material) || 0) + roomArea(room))
  const floorByMaterial = [...finishes].map(([material, area]) => ({ material, area }))
  const points = level.walls.flatMap(wall => [wall.start, wall.end])
  const bounds = points.length ? {
    minX: Math.min(...points.map(point => point.x)), maxX: Math.max(...points.map(point => point.x)),
    minZ: Math.min(...points.map(point => point.z)), maxZ: Math.max(...points.map(point => point.z)),
    top: Math.max(2.7, ...level.walls.map(wall => wall.height)),
  } : null
  const roofArea = level.autoRoof === false
    ? roofRegions(level.rooms.map(room => room.polygon)).reduce((sum, region) => sum + roofSurfaceArea(region.footprint, level.roof || defaultRoof, bounds?.top || 3, true, region.voids), 0)
    : bounds ? roofSurfaceArea([{ x: bounds.minX, z: bounds.minZ }, { x: bounds.maxX, z: bounds.minZ },
      { x: bounds.maxX, z: bounds.maxZ }, { x: bounds.minX, z: bounds.maxZ }], level.roof || defaultRoof, bounds.top) : 0
  return { floorArea, slabArea: slabAreaTotal, floorByMaterial,
    slabByMaterial: [...slabByMaterial].map(([material, area]) => ({ material, area })),
    slabFinishByMaterial: [...slabFinishByMaterial].map(([material, area]) => ({ material, area })),
    wallLength: wallLengthTotal, wallFinishArea: Math.max(0, grossWallArea - openingsArea),
    roofArea, rooms: level.rooms.length, walls: level.walls.length, doors: level.doors.length, windows: level.windows.length,
    stairs: level.stairs?.length || 0, columns: level.columns?.length || 0 }
}
export function buildingQuantities(building: Building) {
  const byLevel = building.levels.map(level => ({ level, quantities: levelQuantities(level) }))
  const sum = (key: 'floorArea' | 'slabArea' | 'wallFinishArea' | 'wallLength' | 'rooms' | 'doors' | 'windows' | 'walls' | 'stairs' | 'columns') =>
    byLevel.reduce((total, item) => total + item.quantities[key], 0)
  const verandaRoofArea = building.levels.reduce((sum, level) => sum + level.doors.reduce((total, door) => {
    const cover = verandaCover(level, door, building.roof || level.roof || defaultRoof)
    return total + (cover ? roofSurfaceArea([{ x: cover.bounds.minX, z: cover.bounds.minZ }, { x: cover.bounds.maxX, z: cover.bounds.minZ },
      { x: cover.bounds.maxX, z: cover.bounds.maxZ }, { x: cover.bounds.minX, z: cover.bounds.maxZ }], cover.roof, cover.bounds.top) : 0)
  }, 0), 0)
  const roofArea = effectiveRoofSections(building).reduce((sum, section) => {
    const level = building.levels.find(item => item.id === section.levelId)
    return level ? sum + roofSurfaceArea(section.footprint, section.roof, section.topHeight || 3, section.followFootprint, section.voids) : sum
  }, verandaRoofArea)
  return { byLevel, floorArea: sum('floorArea'), slabArea: sum('slabArea'), wallFinishArea: sum('wallFinishArea'),
    wallLength: sum('wallLength'), rooms: sum('rooms'), doors: sum('doors'), windows: sum('windows'),
    walls: sum('walls'), stairs: sum('stairs'), columns: sum('columns'), roofArea }
}
