import type { PlanDetail } from './interpretationTypes'
import type { Point, Project } from './types'
import { uid } from './types'
import { newSlab, translateWalls } from './levels'
import { assembleDraft } from '../geometry/reconstruct'
import type { OpeningCandidate } from '../geometry/openingCandidates'
import { enclosedSpaces } from '../geometry/roomTopology'
import type { Wall } from './types'
import { includedSpaces } from '../geometry/spaceReview'
import { rebuildImportedRoof } from './roofDesign'
import { repairGeneratedFence } from '../geometry/site'

function wallBase(wall: Wall): Point[] {
  const dx = wall.end.x - wall.start.x, dz = wall.end.z - wall.start.z, length = Math.hypot(dx, dz)
  const x = -dz / Math.max(.001, length) * wall.thickness / 2, z = dx / Math.max(.001, length) * wall.thickness / 2
  return [{ x: wall.start.x + x, z: wall.start.z + z }, { x: wall.end.x + x, z: wall.end.z + z },
    { x: wall.end.x - x, z: wall.end.z - z }, { x: wall.start.x - x, z: wall.start.z - z }]
}

export function acceptInterpretation(project: Project, levelId: string, walls: Wall[], openings: OpeningCandidate[], details: PlanDetail[], replace: boolean,
  spaceChoices: Record<string, boolean> = {}) {
  const building = project.buildings[0], level = building.levels.find(item => item.id === levelId)
  if (!level || level.locked) return project
  const delta = level.alignment || { x: 0, z: 0 }
  const move = (point: Point): Point => ({ x: point.x + delta.x, z: point.z + delta.z })
  const assembled = assembleDraft(walls, openings.map(item => item.choice === 'unknown' ? { ...item, choice: 'wall' as const } : item))
  const detected = enclosedSpaces(assembled.walls)
  const polygons = includedSpaces(detected, spaceChoices).map(polygon => polygon.map(move))
  const draft = translateWalls(assembled, delta)
  const rooms = polygons.map((polygon, index) => ({ id: uid('room'), name: `Space ${index + 1}`, polygon, material: 'tile' as const, category: 'unclassified' }))
  const slabs = (detected.length ? polygons : draft.walls.map(wallBase)).map(polygon => ({ ...newSlab(polygon, level.slabThickness), autoFromWalls: false }))
  const columns = details.filter(detail => detail.kind === 'column').map(detail => {
    const polygon = detail.polygon.map(move), xs = polygon.map(point => point.x), zs = polygon.map(point => point.z)
    const width = Math.max(...xs) - Math.min(...xs), depth = Math.max(...zs) - Math.min(...zs)
    return { id: uid('column'), position: { x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2 },
      shape: 'rectangular' as const, width, depth, diameter: width, height: level.floorToFloorHeight || 3, material: 'concrete' as const }
  })
  const guides = details.filter(detail => detail.kind === 'stair').map(detail => ({ id: detail.id, polygon: detail.polygon.map(move), evidence: detail.evidence, treadCount: detail.treadCount }))
  if (replace) Object.assign(level, { ...draft, rooms, slabs, columns, stairGuides: guides, autoSlab: false })
  else {
    level.walls.push(...draft.walls); level.doors.push(...draft.doors); level.windows.push(...draft.windows)
    level.passages ||= []; level.passages.push(...draft.passages); level.rooms.push(...rooms)
    level.slabs ||= []; level.slabs.push(...slabs); level.columns ||= []; level.columns.push(...columns)
    level.stairGuides ||= []; level.stairGuides.push(...guides)
  }
  level.autoSlab = false
  level.autoRoof = false
  if (replace) building.roofSections = building.roofSections?.filter(section => section.levelId !== level.id)
  rebuildImportedRoof(building, level)
  repairGeneratedFence(building)
  return project
}
