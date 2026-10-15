import type { Candidate } from '../../../api/src/contracts/analysis'
import type { Level, Point, Project } from '../domain/types'
import { containsPolygon } from '../geometry/polygons'
import { connectStairGuide } from '../domain/stairGuides'
import { ProposalError as ApiError } from './errors'
export function acceptCirculation(project: Project, level: Level, candidates: Candidate[],
  world: (point: { x: number; y: number }) => Point, entityId: (id: string) => string) {
  for (const candidate of candidates.filter(candidate => candidate.kind === 'void')) {
    const polygon = candidate.points.map(world)
    const slabs = level.slabs?.filter(slab => containsPolygon(slab.polygon, polygon)) || []
    if (!slabs.length) throw new ApiError(422, 'VOID_HOST_REQUIRED', 'The reviewed void must fit inside a floor slab. Create or review the floor footprint first.')
    if (slabs.some(slab => slab.openings.some(opening => containsPolygon(opening.polygon, polygon) || containsPolygon(polygon, opening.polygon)))) {
      throw new ApiError(422, 'VOID_OVERLAP', 'The reviewed void overlaps an existing floor opening; review its boundary')
    }
    for (const slab of slabs) slab.openings.push({ id: entityId(`${candidate.id}:${slab.id}`), kind: 'void', polygon })
  }
  for (const candidate of candidates.filter(candidate => candidate.kind === 'stair' && candidate.targetLevelId)) {
    // The existing placement validator checks floor rise, complete flights, collisions and upper slab fit.
    const issue = connectStairGuide(project, level.id, entityId(candidate.id), candidate.targetLevelId!,
      candidate.stairForm || 'straight', candidate.reverse || false)
    if (issue) throw new ApiError(422, 'STAIR_CONNECTION_INVALID', issue)
  }
}
