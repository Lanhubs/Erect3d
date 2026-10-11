import { uid, type Level } from '../domain/types'
import { furnitureIssues } from './entities'
import type { FurnitureCandidate, FurnitureObject } from './types'
export function acceptFurniture(level: Level, candidates: FurnitureCandidate[], levels: Level[]) {
  if (level.locked) return
  level.furniture ||= []
  for (const candidate of candidates) {
    if (candidate.status !== 'accepted' || candidate.levelId !== level.id || level.furniture.some(object => object.sourceDetectionId === candidate.id)) continue
    const { confidence: _confidence, status: _status, issues: _issues, sourceBounds: _bounds, ...entity } = candidate
    const object: FurnitureObject = { ...structuredClone(entity), id: uid('furniture'), sourceDetectionId: candidate.id,
      roomId: furnitureIssues(candidate, level, levels).roomId }
    level.furniture.push(object)
  }
}
