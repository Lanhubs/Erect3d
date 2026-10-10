import type { Project, Selection } from './types'
import { selectedElement, type ElementChange } from './elementGeometry'
import { mutateElement } from './elementMutation'
import { validateOpening } from '../geometry/openingValidation'
import { wallLength } from '../geometry/math'
import { containsPolygon } from '../geometry/polygons'
import { stairPlacementValid } from '../geometry/stairPlacement'
import { repairGeneratedFence } from '../geometry/site'
import { generatedRoof, rebuildImportedRoof } from './roofDesign'

export function validFootprint(points: { x: number; z: number }[]) {
  if (points.length < 3 || points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.z))) return false
  let area = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length]
    if (Math.hypot(a.x - b.x, a.z - b.z) < .03) return false
    if (points.some((p, j) => j !== i && Math.hypot(a.x - p.x, a.z - p.z) < .001)) return false
    area += a.x * b.z - b.x * a.z
    for (let j = i + 2; j < points.length; j++) {
      if ((j + 1) % points.length === i) continue
      const c = points[j], d = points[(j + 1) % points.length]
      const cross = (p: typeof a, q: typeof a, r: typeof a) => (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x)
      if (cross(a, b, c) * cross(a, b, d) < -1e-10 && cross(c, d, a) * cross(c, d, b) < -1e-10) return false
    }
  }
  return Math.abs(area) > .02
}
export function transformElement(input: Project, selection: Selection, change: ElementChange) {
  if (!selection) return { project: input, issue: 'Select a building element first.' }
  const project = structuredClone(input), building = project.buildings[0]
  const target = selectedElement(building, selection)
  if (!target) return { project: input, issue: 'Select a building element first.' }
  const numbers = [change.move?.x, change.move?.z, change.vertex?.point.x, change.vertex?.point.z, change.rotate, change.scale, change.height]
  if (numbers.some(value => value !== undefined && !Number.isFinite(value))) return { project: input, issue: 'Enter finite dimensions and coordinates.' }
  const vertex = change.vertex && target.points[change.vertex.index]
  const changed = Math.hypot(change.move?.x || 0, change.move?.z || 0) > 1e-8 || Math.abs(change.rotate || 0) > 1e-8
    || Math.abs((change.scale ?? 1) - 1) > 1e-8 || Math.abs(change.height || 0) > 1e-8
    || Boolean(vertex && change.vertex && Math.hypot(vertex.x - change.vertex.point.x, vertex.z - change.vertex.point.z) > 1e-8)
  if (!changed) return { project: input, issue: null }
  if (change.scale !== undefined && (!Number.isFinite(change.scale) || change.scale <= 0)) return { project: input, issue: 'Use a positive size.' }
  let issue = mutateElement(project, building, selection, change)
  if (selectedElement(building, selection)?.points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.z))) issue ||= 'Enter finite coordinates.'
  if (!issue) for (const level of building.levels) {
    const before = input.buildings[0].levels.find(item => item.id === level.id)!
    const previous = new Map([...before.walls, ...before.rooms, ...(before.slabs || []), ...(before.columns || []), ...(before.details || []), ...(before.ramps || [])].map(item => [item.id, item]))
    const edited = (item: { id: string }) => JSON.stringify(item) !== JSON.stringify(previous.get(item.id))
    if (level.walls.some(wall => edited(wall) && (wallLength(wall) < .08 || wall.height < .3 || !Number.isFinite(wallLength(wall))))) issue = 'Walls must retain a valid length and height.'
    for (const opening of [...level.doors, ...level.windows, ...(level.passages || [])]) {
      const previous = [...before.doors, ...before.windows, ...(before.passages || [])].find(item => item.id === opening.id)
      if (JSON.stringify(previous) !== JSON.stringify(opening) || JSON.stringify(before.walls.find(wall => wall.id === opening.wallId)) !== JSON.stringify(level.walls.find(wall => wall.id === opening.wallId)))
        issue ||= validateOpening(level, opening)
    }
    if ([...level.rooms, ...(level.slabs || [])].some(item => edited(item) && !validFootprint(item.polygon))) issue ||= 'The footprint must have clear edges and cannot cross itself.'
    if (level.rooms.some(room => edited(room) && room.ceilingHeight !== undefined && room.ceilingHeight < .3)) issue ||= 'Keep the ceiling above the floor.'
    if (level.slabs?.some(slab => edited(slab) && slab.thickness < .05)) issue ||= 'Keep a positive slab thickness.'
    if (level.slabs?.some(slab => edited(slab) && slab.openings.some(opening => !containsPolygon(slab.polygon, opening.polygon)))) issue ||= 'Keep floor openings within their slab.'
    for (const stair of level.stairs || []) {
      const upper = building.levels.find(item => item.id === stair.toLevelId)
      const previous = before.stairs?.find(item => item.id === stair.id), previousUpper = input.buildings[0].levels.find(item => item.id === stair.toLevelId)
      if (!stairPlacementValid(stair, building.levels, upper?.slabs || []) && (!previous || selection.id === stair.id || stairPlacementValid(previous, input.buildings[0].levels, previousUpper?.slabs || [])))
        issue ||= 'This move obstructs a stair or its upper-floor opening.'
    }
    if (level.columns?.some(column => edited(column) && Math.min(column.height, column.width, column.depth, column.diameter) < .05)) issue ||= 'Column dimensions must remain positive.'
    if (level.details?.some(detail => edited(detail) && (detail.height <= 0 || detail.depth <= 0 || Math.hypot(detail.end.x - detail.start.x, detail.end.z - detail.start.z) < .05))) issue ||= 'Detail dimensions must remain positive.'
    if (level.ramps?.some(ramp => edited(ramp) && (ramp.width < .3 || Math.hypot(ramp.end.x - ramp.start.x, ramp.end.z - ramp.start.z) < .3 || !Number.isFinite(ramp.endElevation)))) issue ||= 'Keep a valid ramp width, run and elevation.'
  }
  if (selection.kind === 'fence' && building.siteFence && (!validFootprint(building.siteFence.boundary || []) || building.siteFence.height <= .1)) issue ||= 'The fence must have a valid boundary and height.'
  if (issue) return { project: input, issue }
  if (['room', 'wall', 'slab'].includes(selection.kind)) building.levels.forEach(level => {
    if (building.roofSections?.some(section => section.levelId === level.id && generatedRoof(section))) rebuildImportedRoof(building, level)
  })
  repairGeneratedFence(building)
  return { project, issue: null }
}
