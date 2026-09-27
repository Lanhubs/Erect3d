import { defaultRoof, uid, type Building, type Level, type Point, type Project, type Slab } from './types'

export function wallEnvelope(level: Level): Point[] {
  const points = level.walls.flatMap(wall => [wall.start, wall.end])
  if (!points.length) return []
  const minX = Math.min(...points.map(point => point.x)), maxX = Math.max(...points.map(point => point.x))
  const minZ = Math.min(...points.map(point => point.z)), maxZ = Math.max(...points.map(point => point.z))
  return [{ x: minX, z: minZ }, { x: maxX, z: minZ }, { x: maxX, z: maxZ }, { x: minX, z: maxZ }]
}

export function newSlab(polygon: Point[], thickness = .2): Slab {
  return { id: uid('slab'), polygon, thickness, elevation: 0, structuralMaterial: 'reinforced-concrete',
    finishMaterial: 'concrete', openings: [] }
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
    building.roof ||= building.levels.at(-1)?.roof || { ...defaultRoof }
    for (const level of building.levels) {
      level.floorToFloorHeight ||= Math.max(2.7, ...level.walls.map(wall => wall.height + level.slabThickness))
      level.passages ||= []
      level.columns ||= []
      level.stairs ||= []
      level.visible ??= true
      level.locked ??= false
      level.slabs ??= wallEnvelope(level).length ? [newSlab(wallEnvelope(level), level.slabThickness)] : []
      if (!level.sourceId && level === building.levels[0] && project.sources?.[0]) level.sourceId = project.sources[0].id
      if (!level.calibration && level === building.levels[0] && project.calibration) level.calibration = project.calibration
      level.alignment ||= { x: 0, z: 0 }
    }
  }
  return project
}

export function blankLevel(name: string, elevation: number, floorToFloorHeight: number): Level {
  return { id: uid('level'), name, elevation, floorToFloorHeight, visible: true, locked: false,
    walls: [], doors: [], windows: [], passages: [], rooms: [], slabs: [], columns: [], stairs: [],
    slabThickness: .2, alignment: { x: 0, z: 0 } }
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
  level.slabs?.forEach(slab => { slab.id = uid('slab'); slab.openings.forEach(opening => { opening.id = uid('opening') }) })
  level.columns?.forEach(column => { column.id = uid('column') })
  return level
}

export function topLevel(building: Building): Level {
  return building.levels.reduce((top, level) => level.elevation > top.elevation ? level : top)
}
