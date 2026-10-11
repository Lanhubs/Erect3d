import type { Project } from '../../contracts/project'
import { ApiError } from '../../security/errors'
import { wallLength } from '../../../../client/src/geometry/math'

export function validateGeometry(project: Project) {
  const ids = new Set<string>()
  function unique(value: unknown) {
    if (Array.isArray(value)) { value.forEach(unique); return }
    if (!value || typeof value !== 'object') return
    if ('id' in value && typeof value.id === 'string') {
      if (ids.has(value.id)) throw new ApiError(422, 'DUPLICATE_ID', 'Document contains duplicate IDs')
      ids.add(value.id)
    }
    Object.values(value).forEach(unique)
  }
  unique(project)
  const sources = new Set(project.sources.map(item => item.id))
  for (const building of project.buildings) {
    const levels = new Set(building.levels.map(item => item.id))
    for (const section of building.roofSections || []) {
      if (!levels.has(section.levelId)) throw new ApiError(422, 'INVALID_REFERENCE', 'Roof section level is missing')
    }
    for (const view of building.walkViewpoints || []) {
      if (!levels.has(view.levelId)) throw new ApiError(422, 'INVALID_REFERENCE', 'Viewpoint level is missing')
    }
    for (const level of building.levels) {
      if (level.sourceId && !sources.has(level.sourceId)) throw new ApiError(422, 'INVALID_REFERENCE', 'Source metadata is missing')
      const walls = new Map(level.walls.map(wall => [wall.id, wall]))
      for (const wall of level.walls) {
        if (wallLength(wall) < .001) throw new ApiError(422, 'INVALID_GEOMETRY', 'Wall must have a length')
      }
      for (const opening of [...level.doors, ...level.windows, ...(level.passages || [])]) {
        const wall = walls.get(opening.wallId)
        const sill = 'sill' in opening && typeof opening.sill === 'number' ? opening.sill : 0
        if (!wall || opening.offset < -.001 || opening.offset + opening.width > wallLength(wall) + .001 ||
          sill < 0 || !(level.passages || []).some(passage=>passage.id===opening.id) && sill + opening.height > wall.height + .001) {
          throw new ApiError(422, 'INVALID_GEOMETRY', 'Opening must fit its host wall')
        }
      }
      for (const stair of level.stairs || []) {
        const target = building.levels.find(item => item.id === stair.toLevelId)
        if (stair.fromLevelId !== level.id || !target || target.elevation <= level.elevation) {
          throw new ApiError(422, 'INVALID_REFERENCE', 'Stair must connect its source level to a higher level')
        }
        if (stair.openingId && !target.slabs?.some(slab => slab.openings.some(item => item.id === stair.openingId))) {
          throw new ApiError(422, 'INVALID_REFERENCE', 'Stair opening is missing from the target level')
        }
      }
      for (const furniture of level.furniture || []) {
        if (furniture.levelId !== level.id || (furniture.roomId && !level.rooms.some(room => room.id === furniture.roomId))) {
          throw new ApiError(422, 'INVALID_REFERENCE', 'Furniture must reference its own level and room')
        }
      }
    }
    const fence = building.siteFence
    for (const gate of fence?.gates || []) {
      const segment = fence?.segments.find(item => item.id === gate.segmentId)
      if (!segment || gate.offset < 0 || gate.offset + gate.width > Math.hypot(segment.end.x - segment.start.x, segment.end.z - segment.start.z) + .001) {
        throw new ApiError(422, 'INVALID_REFERENCE', 'Fence gate must fit its segment')
      }
    }
  }
}
