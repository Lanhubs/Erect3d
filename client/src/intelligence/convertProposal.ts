import type { Candidate, AnalysisInput } from '../../../api/src/contracts/analysis'
import type { Level, Project, Point } from '../domain/types'
import type { Wall } from '../domain/types'
import { furnitureTypes } from '../furniture/types'
import { ProposalError as ApiError } from './errors'
import {projectOpening} from '../geometry/openingProjection'
import {constructionAssumptions} from './constructionAssumptions'

import { enclosedSpaces } from '../geometry/roomTopology'
import { newSlab } from '../domain/levels'
import { acceptCirculation } from './circulation'
import { removeProposal } from './removeProposal'

export function imageToWorld(point: { x: number; y: number }, width: number, height: number, input: AnalysisInput): Point {
  return { x: (point.x * width - input.calibration.a.x) * input.calibration.metresPerPixel + (input.alignment?.x || 0),
    z: (point.y * height - input.calibration.a.z) * input.calibration.metresPerPixel + (input.alignment?.z || 0) }
}
export function convertProposal(project: Project, input: AnalysisInput, analysisId: string,
  candidates: Candidate[], dimensions: { width: number; height: number }, makeId?: (candidateId: string, suffix: string) => string) {
  const document = structuredClone(project)
  const building = document.buildings.find(building => building.levels.some(level => level.id === input.levelId))!
  const level = building?.levels.find(level => level.id === input.levelId)
  if (!level || level.locked) throw new ApiError(409, 'LEVEL_LOCKED', 'Target level is unavailable or locked')
  const chosen=candidates.filter(item=>item.action!=='remove')
  const world = (point: { x: number; y: number }) => imageToWorld(point, dimensions.width, dimensions.height, input)
  const previewIds = new Map<string,string>()
  const entityId=(candidateId:string,suffix='')=>{if(makeId)return makeId(candidateId,suffix);const key=candidateId+':'+suffix;if(!previewIds.has(key))previewIds.set(key,'preview_'+previewIds.size);return previewIds.get(key)!}
  const hostMap = new Map<string, Wall[]>()
  const record = (id: string,candidate:Candidate) => {
    document.interpretation ||= {}
    const previous=document.interpretation[id]
    document.interpretation[id] = { ...(previous || { origin: 'detected', confirmedFields: [] }), sourceId: input.sourceId, analysisId,
      inferredFields:constructionAssumptions(candidate).filter(field=>!previous?.confirmedFields.includes(field)),evidence:candidate.evidence,assumptions:candidate.uncertainties }
  }
  for (const candidate of chosen.filter(candidate => candidate.kind === 'wall')) {
    const points = candidate.points.map(world), walls: Wall[] = []
    if (points.length < 2) throw new ApiError(422, 'INVALID_CANDIDATE', 'Wall requires two points')
    const existing = candidate.targetId ? level.walls.find(wall => wall.id === candidate.targetId) : undefined
    if (candidate.targetId && (!existing || points.length !== 2)) throw new ApiError(422, 'INVALID_TARGET', 'A wall correction must reference one existing wall')
    for (let index = 0; index < points.length - 1; index++) {
      const wall: Wall = { material: 'plaster', ...existing, id: existing?.id || entityId(candidate.id,String(index)), start: points[index], end: points[index + 1],
        thickness: candidate.thickness ? candidate.thickness * dimensions.width * input.calibration.metresPerPixel : existing?.thickness || .2,
        height: candidate.heightMetres || existing?.height || level.floorToFloorHeight || 3, kind:candidate.wallKind || existing?.kind }
      if (candidate.curve) {
        if (points.length !== 2) throw new ApiError(422, 'INVALID_CANDIDATE', 'Arc wall requires two endpoints')
        wall.curve = { ...candidate.curve, center: world(candidate.curve.center),
          radius: candidate.curve.radius * dimensions.width * input.calibration.metresPerPixel }
      }
      walls.push(wall)
      record(wall.id,candidate)
    }
    hostMap.set(candidate.id,walls)
    if (existing) level.walls[level.walls.indexOf(existing)] = walls[0]
    else level.walls.push(...walls)
  }
  for (const candidate of chosen.filter(candidate => candidate.kind !== 'wall')) {
    if(candidate.kind==='void'||candidate.kind==='architectural-boundary')continue
    const points = candidate.points.map(world), id = candidate.targetId || entityId(candidate.id)
    if (candidate.targetId) {
      const collection = candidate.kind === 'door' ? level.doors : candidate.kind === 'window' ? level.windows
        : candidate.kind === 'passage' ? level.passages : candidate.kind === 'room' ? level.rooms : candidate.kind === 'column' ? level.columns : undefined
      if (!collection?.some(item => item.id === candidate.targetId)) throw new ApiError(422, 'INVALID_TARGET', 'Correction does not reference an existing entity of this kind')
    }
    record(id,candidate)
    if (candidate.kind === 'unknown' || candidate.kind === 'stair') {
      if (candidate.kind === 'stair' && points.length >= 3) {
        level.stairGuides ||= []
        level.stairGuides.push({ id, polygon: points, evidence: candidate.evidence })
        continue
      }
      throw new ApiError(422, 'MANUAL_REVIEW_REQUIRED', 'Unknown geometry and voids require explicit domain edits; stairs need an opening and target level')
    }
    if (candidate.kind === 'door' || candidate.kind === 'window' || candidate.kind === 'passage') {
      appendOpening(level, candidate, points, hostMap, id)
    } else if (candidate.kind === 'room') {
      const existing = level.rooms.find(room => room.id === id)
      const room = { material: candidate.roomCategory==='basketball-court'?'timber' as const:'tile' as const, ...existing, id, name: candidate.label || existing?.name || 'Reviewed space', polygon: points,
        ...(candidate.roomCategory?{category:candidate.roomCategory}:{}) }
      if (existing) level.rooms[level.rooms.indexOf(existing)] = room; else level.rooms.push(room)
    } else if (candidate.kind === 'column' || candidate.kind === 'furniture') {
      const xs = points.map(point => point.x), zs = points.map(point => point.z)
      const width = Math.max(...xs) - Math.min(...xs), depth = Math.max(...zs) - Math.min(...zs)
      const position = { x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2 }
      if (candidate.kind === 'column') {
        level.columns ||= []
        const existing = level.columns.find(column => column.id === id)
        const column = { material: 'concrete' as const, ...existing, id, position, width, depth, diameter: Math.min(width, depth), shape: candidate.columnShape || existing?.shape || 'rectangular' as const, height: candidate.heightMetres || existing?.height || 3 }
        if (existing) level.columns[level.columns.indexOf(existing)] = column; else level.columns.push(column)
      } else {
        const type = furnitureTypes.find(type => type === candidate.furnitureType)
        if (!type || type === 'unknown') throw new ApiError(422, 'MANUAL_REVIEW_REQUIRED', 'Choose a known furniture type')
        level.furniture ||= []
        level.furniture.push({ id, type, levelId: level.id, position, rotation: 0, width, depth,
          height: candidate.heightMetres || .8, assetId: `builtin:${type}`, sourceDetectionId: `${analysisId}:${candidate.id}` })
      }
    }
  }
  removeProposal(document,level,candidates)
  if (!level.rooms.length && chosen.some(candidate=>candidate.kind==='wall')) level.rooms = enclosedSpaces(level.walls).map((polygon, index) => ({
    id: entityId(`derived-room-${index}`), name: `Space ${index + 1}`, polygon, material: 'tile',
  }))
  if (chosen.length && !level.slabs?.length && level.rooms.length) level.slabs = level.rooms.map((room,index) => ({...newSlab(room.polygon, level.slabThickness),id:entityId(`derived-slab-${index}`)}))
  acceptCirculation(document, level, chosen, world, entityId)
  // Interpretation accepts measured geometry. Roof design remains a separate user choice.
  return document
}
function appendOpening(level: Level, candidate: Candidate, points: Point[], hosts: Map<string,Wall[]>, id: string) {
  if (points.length !== 2 || !candidate.wallId) throw new ApiError(422, 'INVALID_HOST', `Review ${candidate.id}: opening needs two points and a reviewed host wall`)
  const walls = hosts.get(candidate.wallId) || level.walls.filter(wall => wall.id === candidate.wallId)
  const wall=walls.find(wall=>projectOpening(wall,points))
  if(!wall)throw new ApiError(422,'INVALID_HOST',`Review ${candidate.id}: opening endpoints must follow the reviewed host wall gap, not the door leaf or swing`)
  const {offset,width}=projectOpening(wall,points)!,opposite=offset
  if (candidate.kind === 'passage') {
    level.passages ||= []
    const existing = level.passages.find(item => item.id === id)
    upsert(level.passages, { ...existing, id, wallId: wall.id, offset: Math.min(offset,opposite), width, height: candidate.heightMetres || existing?.height || 2.2 })
  } else if (candidate.kind === 'door') {
    const existing = level.doors.find(item => item.id === id)
    upsert(level.doors, { ...existing, id, wallId: wall.id, offset: Math.min(offset,opposite), width, height: candidate.heightMetres || existing?.height || 2.1,
      hinge: candidate.hinge || existing?.hinge || 'left', style: candidate.doorStyle || existing?.style || 'panel', leafStyle:candidate.doorLeafStyle||existing?.leafStyle,swing: candidate.swing || existing?.swing })
  } else {
    const existing = level.windows.find(item => item.id === id)
    upsert(level.windows, { ...existing,...candidate.windowConstruction, id, wallId: wall.id, offset: Math.min(offset,opposite), width, height: candidate.heightMetres || existing?.height || 1.2, sill: candidate.sillMetres ?? existing?.sill ?? .8, type:candidate.windowType || existing?.type })
  }
}
function upsert<T extends { id: string }>(items: T[], next: T) {
  const index = items.findIndex(item => item.id === next.id)
  if (index < 0) items.push(next); else items[index] = next
}
