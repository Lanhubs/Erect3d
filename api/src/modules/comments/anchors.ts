import type { z } from 'zod'
import type { Database } from '../../db/connection'
import type { anchorSchema } from '../../contracts/review'
import { ApiError } from '../../security/errors'
import { loadDocument } from '../projects/documents'

export async function validateAnchor(
  db: Database,
  projectId: string,
  anchor: z.infer<typeof anchorSchema>,
  revision?: number,
) {
  const { document } = await loadDocument(db, projectId, revision)
  const levels = document.buildings.flatMap((building) => building.levels)
  if (anchor.levelId && !levels.some((level) => level.id === anchor.levelId))
    throw new ApiError(422, 'INVALID_ANCHOR', 'Level is not part of this project')
  const targetLevels = anchor.levelId ? levels.filter((level) => level.id === anchor.levelId) : levels
  if (anchor.entityId) {
    const ids = new Set<string>()
    const walk = (value: unknown) => {
      if (!value || typeof value !== 'object') return
      if ('id' in value && typeof value.id === 'string') ids.add(value.id)
      Object.values(value).forEach(walk)
    }
    targetLevels.forEach(walk)
    document.buildings.forEach((building) => {
      walk(building.siteFence)
      walk(building.roofSections)
    })
    if (!ids.has(anchor.entityId))
      throw new ApiError(422, 'INVALID_ANCHOR', 'Entity is not part of this project')
  }
  if (anchor.viewpointId) {
    const [view] =
      await db`SELECT 1 FROM saved_views WHERE id=${anchor.viewpointId} AND project_id=${projectId}`
    if (
      !view &&
      !document.buildings.some((building) =>
        building.walkViewpoints?.some((view) => view.id === anchor.viewpointId),
      )
    ) {
      throw new ApiError(422, 'INVALID_ANCHOR', 'Viewpoint is not part of this project')
    }
  }
  if (anchor.screenshotAssetId) {
    const [asset] =
      await db`SELECT 1 FROM assets WHERE id=${anchor.screenshotAssetId} AND project_id=${projectId} AND kind='screenshot' AND state='ready'`
    if (!asset) throw new ApiError(422, 'INVALID_ANCHOR', 'Screenshot is unavailable')
  }
}
