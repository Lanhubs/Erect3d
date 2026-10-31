import type { Database } from '../../db/connection'
import type { Job } from '../../jobs/queue'
import { ApiError } from '../../security/errors'
import { assertLease } from '../../jobs/lease'
import { isCadMime, isRasterMime } from '../../../../client/src/domain/sourceMime'

export type CadLink = {
  sourceId: string
  originalAssetId: string
  rasterAssetId: string
  width: number
  height: number
}

/** The worker owns this row until the client saves a document that names the source. */
export async function linkConvertedSource(tx: Database, job: Job, link: CadLink) {
  await assertLease(tx, job)
  const [original] =
    await tx`SELECT mime,kind FROM assets WHERE id=${link.originalAssetId} AND project_id=${job.project_id} AND state='ready'`
  if (!original || !isCadMime(original.mime) || original.kind !== 'source')
    throw new ApiError(422, 'INVALID_ASSET', 'The CAD original is missing or is not a source document')
  const [raster] =
    await tx`SELECT mime FROM assets WHERE id=${link.rasterAssetId} AND project_id=${job.project_id} AND state='ready'`
  if (!raster || !isRasterMime(raster.mime))
    throw new ApiError(422, 'INVALID_ASSET', 'The converted raster is not a ready image asset')
  const [existing] =
    await tx`SELECT original_asset_id FROM source_plans WHERE project_id=${job.project_id} AND source_id=${link.sourceId}`
  if (existing && existing.original_asset_id !== link.originalAssetId)
    throw new ApiError(409, 'ALREADY_LINKED', 'That source identifier already belongs to another drawing')
  await tx`INSERT INTO source_plans(project_id,source_id,original_asset_id,raster_asset_id,page,width,height)
    VALUES (${job.project_id},${link.sourceId},${link.originalAssetId},${link.rasterAssetId},NULL,${link.width},${link.height})
    ON CONFLICT(project_id,source_id) DO UPDATE
    SET raster_asset_id=EXCLUDED.raster_asset_id,width=EXCLUDED.width,height=EXCLUDED.height`
}
