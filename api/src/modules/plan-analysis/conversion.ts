import type { Candidate, AnalysisInput } from '../../contracts/analysis'
import type { Level, Project, Point } from '../../contracts/project'
import type { Wall } from '../../../../client/src/domain/types'
import { furnitureTypes } from '../../../../client/src/furniture/types'
import { digest } from '../../security/tokens'
import { ApiError } from '../../security/errors'
import { wallLength } from '../../../../client/src/geometry/math'
import { rebuildImportedRoof } from '../../../../client/src/domain/roofDesign'
import { enclosedSpaces } from '../../../../client/src/geometry/roomTopology'
import { newSlab } from '../../../../client/src/domain/levels'

export function imageToWorld(point: { x: number; y: number }, width: number, height: number, input: AnalysisInput): Point {
  return { x: point.x * width * input.calibration.metresPerPixel + (input.alignment?.x || 0),
    z: point.y * height * input.calibration.metresPerPixel + (input.alignment?.z || 0) }
}
export function convertCandidates(project: Project, input: AnalysisInput, analysisId: string,
  candidates: Candidate[], dimensions: { width: number; height: number }) {
  const document = structuredClone(project)
  const building = document.buildings.find(building => building.levels.some(level => level.id === input.levelId))!
  const level = building?.levels.find(level => level.id === input.levelId)
  if (!level || level.locked) throw new ApiError(409, 'LEVEL_LOCKED', 'Target level is unavailable or locked')
  const world = (point: { x: number; y: number }) => imageToWorld(point, dimensions.width, dimensions.height, input)
  const entityId = (candidateId: string, suffix = '') => `ai_${digest(`${analysisId}:${candidateId}:${suffix}`).slice(0,32)}`
  const hostMap = new Map<string, Wall[]>()
  for (const candidate of candidates.filter(candidate => candidate.kind === 'wall')) {
    const points = candidate.points.map(world), walls: Wall[] = []
    if (points.length < 2) throw new ApiError(422, 'INVALID_CANDIDATE', 'Wall requires two points')
    for (let index = 0; index < points.length - 1; index++) {
      const wall: Wall = { id: entityId(candidate.id,String(index)), start: points[index], end: points[index + 1],
        thickness: Math.max(.05, (candidate.thickness || .004) * dimensions.width * input.calibration.metresPerPixel),
        height: candidate.heightMetres || level.floorToFloorHeight || 3, material: 'plaster' }
      if (candidate.curve) {
        if (points.length !== 2) throw new ApiError(422, 'INVALID_CANDIDATE', 'Arc wall requires two endpoints')
        wall.curve = { ...candidate.curve, center: world(candidate.curve.center),
          radius: candidate.curve.radius * dimensions.width * input.calibration.metresPerPixel }
      }
      walls.push(wall)
    }
    hostMap.set(candidate.id,walls)
    level.walls.push(...walls)
  }
  for (const candidate of candidates.filter(candidate => candidate.kind !== 'wall')) {
    const points = candidate.points.map(world), id = entityId(candidate.id)
    if (candidate.kind === 'unknown' || candidate.kind === 'void' || candidate.kind === 'stair') {
      if (candidate.kind === 'stair' && points.length >= 3) {
        level.stairGuides ||= []
        level.stairGuides.push({ id, polygon: points, evidence: candidate.evidence })
        continue
      }
      throw new ApiError(422, 'MANUAL_REVIEW_REQUIRED', 'Unknown geometry and voids require explicit domain edits; stairs need an opening and target level')
    }
    if (candidate.kind === 'door' || candidate.kind === 'window') {
      appendOpening(level, candidate, points, hostMap, id)
    } else if (candidate.kind === 'room') {
      level.rooms.push({ id, name: candidate.label || 'Reviewed space', polygon: points, material: 'tile' })
    } else if (candidate.kind === 'column' || candidate.kind === 'furniture') {
      const xs = points.map(point => point.x), zs = points.map(point => point.z)
      const width = Math.max(...xs) - Math.min(...xs), depth = Math.max(...zs) - Math.min(...zs)
      const position = { x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2 }
      if (candidate.kind === 'column') {
        level.columns ||= []
        level.columns.push({ id, position, width, depth, diameter: width, shape: 'rectangular', height: candidate.heightMetres || 3, material: 'concrete' })
      } else {
        const type = furnitureTypes.find(type => type === candidate.furnitureType)
        if (!type || type === 'unknown') throw new ApiError(422, 'MANUAL_REVIEW_REQUIRED', 'Choose a known furniture type')
        level.furniture ||= []
        level.furniture.push({ id, type, levelId: level.id, position, rotation: 0, width, depth,
          height: candidate.heightMetres || .8, assetId: `builtin:${type}`, sourceDetectionId: `${analysisId}:${candidate.id}` })
      }
    }
  }
  if (!level.rooms.length) level.rooms = enclosedSpaces(level.walls).map((polygon, index) => ({
    id: entityId(`derived-room-${index}`), name: `Space ${index + 1}`, polygon, material: 'tile',
  }))
  if (!level.slabs?.length && level.rooms.length) level.slabs = level.rooms.map(room => newSlab(room.polygon, level.slabThickness))
  level.autoRoof = false
  rebuildImportedRoof(building,level)
  return document
}
function appendOpening(level: Level, candidate: Candidate, points: Point[], hosts: Map<string,Wall[]>, id: string) {
  if (points.length !== 2 || !candidate.wallId) throw new ApiError(422, 'INVALID_HOST', 'Opening needs two points and a reviewed host wall')
  const walls = hosts.get(candidate.wallId) || level.walls.filter(wall => wall.id === candidate.wallId)
  const middle = { x: (points[0].x + points[1].x)/2, z: (points[0].z + points[1].z)/2 }
  const wall = walls.find(wall => {
    const dx = wall.end.x-wall.start.x, dz = wall.end.z-wall.start.z, length = wallLength(wall)
    const offset = ((middle.x-wall.start.x)*dx+(middle.z-wall.start.z)*dz)/length
    return !wall.curve && offset >= 0 && offset <= length && Math.abs((middle.x-wall.start.x)*dz-(middle.z-wall.start.z)*dx)/length < wall.thickness
  })
  if (!wall) throw new ApiError(422, 'INVALID_HOST', 'Opening does not fit a straight reviewed wall; review curved openings manually')
  const length = wallLength(wall), width = Math.hypot(points[1].x-points[0].x,points[1].z-points[0].z)
  const offset = ((points[0].x-wall.start.x)*(wall.end.x-wall.start.x)+(points[0].z-wall.start.z)*(wall.end.z-wall.start.z))/length
  const opposite = ((points[1].x-wall.start.x)*(wall.end.x-wall.start.x)+(points[1].z-wall.start.z)*(wall.end.z-wall.start.z))/length
  if (candidate.kind === 'door') level.doors.push({ id, wallId: wall.id, offset: Math.min(offset,opposite), width, height: candidate.heightMetres || 2.1, hinge: 'left', style: 'panel' })
  else level.windows.push({ id, wallId: wall.id, offset: Math.min(offset,opposite), width, height: candidate.heightMetres || 1.2, sill: .8 })
}
