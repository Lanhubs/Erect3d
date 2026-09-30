import { defaultRoof, uid, type Building, type Level, type Point, type Project, type Slab, type Stair, type Wall } from './types'
import { containsPolygon } from '../geometry/polygons'
import { findStairPlacement } from '../geometry/stairPlacement'
import { stairOpening } from '../geometry/stairs'

const moved = (point: Point, delta: Point): Point => ({ x: point.x + delta.x, z: point.z + delta.z })
export function translateWalls<T extends { walls: Wall[] }>(draft: T, delta: Point): T {
  draft.walls.forEach(wall => { wall.start = moved(wall.start, delta); wall.end = moved(wall.end, delta) })
  return draft
}
export function translateLevel(level: Level, delta: Point) {
  translateWalls(level, delta)
  level.rooms.forEach(room => { room.polygon = room.polygon.map(point => moved(point, delta)) })
  level.slabs?.forEach(slab => { slab.polygon = slab.polygon.map(point => moved(point, delta))
    slab.openings.forEach(opening => { opening.polygon = opening.polygon.map(point => moved(point, delta)) }) })
  level.columns?.forEach(column => { column.position = moved(column.position, delta) })
  level.stairs?.forEach(stair => { stair.start = moved(stair.start, delta) })
}

export function wallEnvelope(level: Level): Point[] {
  const points = level.walls.flatMap(wall => [wall.start, wall.end])
  if (!points.length) return []
  const minX = Math.min(...points.map(point => point.x)), maxX = Math.max(...points.map(point => point.x))
  const minZ = Math.min(...points.map(point => point.z)), maxZ = Math.max(...points.map(point => point.z))
  return [{ x: minX, z: minZ }, { x: maxX, z: minZ }, { x: maxX, z: maxZ }, { x: minX, z: maxZ }]
}

export function newSlab(polygon: Point[], thickness = .2): Slab {
  return { id: uid('slab'), polygon, thickness, elevation: 0, structuralMaterial: 'reinforced-concrete',
    finishMaterial: 'concrete', openings: [], autoFromWalls: true }
}
export function refreshAutoSlabs(level: Level) {
  const polygon = wallEnvelope(level)
  if (!polygon.length || polygon[1].x - polygon[0].x < .5 || polygon[2].z - polygon[1].z < .5) return
  level.slabs ||= []
  const automatic = level.slabs.find(slab => slab.autoFromWalls)
  if (automatic) automatic.polygon = polygon
  else if (level.autoSlab && !level.slabs.length) level.slabs.push(newSlab(polygon, level.slabThickness))
}

export function connectAdjacentLevels(project: Project) {
  const levels = project.buildings[0].levels.toSorted((a, b) => a.elevation - b.elevation)
  for (let index = 0; index < levels.length - 1; index++) {
    const from = levels[index], to = levels[index + 1]
    if (from.locked || to.locked) continue
    const existing = from.stairs?.find(stair => stair.fromLevelId === from.id && stair.toLevelId === to.id)
    const targetSlabs = to.slabs?.length ? to.slabs : [newSlab(wallEnvelope(to), to.slabThickness)]
    const initial: Stair = existing || { id: uid('stair'), fromLevelId: from.id, toLevelId: to.id,
      start: { x: 0, z: 0 }, direction: 0, form: 'straight', width: 1.1,
      riserHeight: .17, treadDepth: .28, landingLength: 1.2, openingId: uid('opening') }
    const stair = existing || findStairPlacement(initial, levels, targetSlabs)
    if (!stair) continue
    const openingPolygon = stairOpening(stair, levels)
    const slab = targetSlabs.find(item => containsPolygon(item.polygon, openingPolygon))
    if (!slab) continue
    if (!existing) { from.stairs ||= []; from.stairs.push(stair) }
    to.slabs ||= []
    if (!to.slabs.length) to.slabs.push(slab)
    const openingId = stair.openingId ||= uid('opening')
    to.slabs.forEach(item => { item.openings = item.openings.filter(opening => opening.id !== openingId) })
    to.slabs.find(item => item.id === slab.id)?.openings.push({ id: openingId, kind: 'stair', polygon: openingPolygon })
  }
}

export function normalizeProject(input: Project): Project {
  const project = structuredClone(input)
  const legacy = project as Project & Partial<Level>
  if (!project.buildings?.length) {
    const level: Level = { id: uid('level'), name: 'Ground floor', elevation: 0, walls: legacy.walls || [],
      doors: legacy.doors || [], windows: legacy.windows || [], passages: legacy.passages || [],
      rooms: legacy.rooms || [], slabThickness: legacy.slabThickness || .2, roof: legacy.roof || { ...defaultRoof } }
    project.buildings = [{ id: uid('building'), name: project.name, levels: [level] }]
  }
  for (const building of project.buildings) {
    building.levels ||= []
    if (!building.levels.length) building.levels.push(blankLevel('Ground floor', 0, 3))
    building.levels.sort((a, b) => a.elevation - b.elevation)
    const hasAssignedSource = building.levels.some(level => Boolean(level.sourceId))
    building.roof ||= building.levels.at(-1)?.roof || { ...defaultRoof }
    for (const level of building.levels) {
      level.floorToFloorHeight ||= Math.max(2.7, ...level.walls.map(wall => wall.height + level.slabThickness))
      level.passages ||= []
      level.columns ||= []
      level.stairs ||= []
      level.visible ??= true
      level.locked ??= false
      level.slabs ??= wallEnvelope(level).length ? [newSlab(wallEnvelope(level), level.slabThickness)] : []
      level.autoSlab ??= level.slabs.some(slab => slab.autoFromWalls) || !level.slabs.length
      if (!hasAssignedSource && !level.sourceId && level === building.levels[0] && project.sources?.[0]) level.sourceId = project.sources[0].id
      if (!level.calibration && level === building.levels[0] && project.calibration) level.calibration = project.calibration
      level.alignment ||= { x: 0, z: 0 }
    }
    connectAdjacentLevels({ ...project, buildings: [building] })
  }
  return project
}

export function blankLevel(name: string, elevation: number, floorToFloorHeight: number): Level {
  return { id: uid('level'), name, elevation, floorToFloorHeight, visible: true, locked: false,
    walls: [], doors: [], windows: [], passages: [], rooms: [], slabs: [], columns: [], stairs: [],
    slabThickness: .2, alignment: { x: 0, z: 0 }, autoSlab: true }
}

export function duplicateLevel(source: Level, name: string, elevation: number): Level {
  const level = structuredClone(source)
  const wallIds = new Map(level.walls.map(wall => [wall.id, uid('wall')]))
  level.id = uid('level'); level.name = name; level.elevation = elevation
  level.sourceId = undefined; level.calibration = undefined; level.stairs = []; level.locked = false; level.visible = true
  level.walls.forEach(wall => { wall.id = wallIds.get(wall.id)! })
  level.doors.forEach(door => { door.id = uid('door'); door.wallId = wallIds.get(door.wallId) || door.wallId })
  level.windows.forEach(window => { window.id = uid('window'); window.wallId = wallIds.get(window.wallId) || window.wallId })
  level.passages?.forEach(passage => { passage.id = uid('passage'); passage.wallId = wallIds.get(passage.wallId) || passage.wallId })
  level.rooms.forEach(room => { room.id = uid('room') })
  level.slabs?.forEach(slab => { slab.id = uid('slab'); slab.openings = slab.openings.filter(opening => opening.kind !== 'stair')
    slab.openings.forEach(opening => { opening.id = uid('opening') }) })
  level.columns?.forEach(column => { column.id = uid('column') })
  return level
}

export function topLevel(building: Building): Level {
  return building.levels.reduce((top, level) => level.elevation > top.elevation ? level : top)
}
