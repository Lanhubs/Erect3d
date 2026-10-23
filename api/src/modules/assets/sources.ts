import { Hono } from 'hono'
import { z } from 'zod'
import type { Database } from '../../db/connection'
import type { ApiEnv } from '../../middleware/types'
import { body, param } from '../../contracts/http'
import { id } from '../../contracts/primitives'
import { authorize } from '../../security/permissions'
import { ApiError } from '../../security/errors'
import { loadDocument } from '../projects/documents'
export const sourceLinkSchema = z
  .object({ originalAssetId: id, rasterAssetId: id.optional(), page: z.number().int().positive().optional() })
  .strict()
export function sourceRoutes(db: Database) {
  const routes = new Hono<ApiEnv>()
  routes.get('/:projectId/sources', async (context) => {
    const projectId = param(context, 'projectId')
    await authorize(db, context.get('actor'), projectId)
    const { document } = await loadDocument(db, projectId)
    const rows =
      await db`SELECT source_id,original_asset_id,raster_asset_id,page FROM source_plans WHERE project_id=${projectId}`
    return context.json(
      rows.filter((row: { source_id: string }) =>
        document.sources.some((source) => source.id === row.source_id),
      ),
    )
  })
  routes.put('/:projectId/sources/:sourceId', async (context) => {
    const projectId = param(context, 'projectId'),
      sourceId = param(context, 'sourceId'),
      input = await body(context, sourceLinkSchema)
    await db.begin(async (tx) => {
      await authorize(tx, context.get('actor'), projectId, 'edit')
      const { document } = await loadDocument(tx, projectId),
        source = document.sources.find((source) => source.id === sourceId)
      if (!source)
        throw new ApiError(422, 'INVALID_SOURCE', 'Source metadata must be in the canonical document')
      const [original] =
        await tx`SELECT * FROM assets WHERE id=${input.originalAssetId} AND project_id=${projectId} AND state='ready' AND kind='source'`
      if (!original || original.mime !== source.mime)
        throw new ApiError(422, 'INVALID_ASSET', 'Original asset does not match the source format')
      if (source.mime === 'application/pdf' && (!input.rasterAssetId || input.page !== source.page))
        throw new ApiError(422, 'PDF_PAGE_REQUIRED', 'Link the selected PDF page raster separately')
      const rasterId = input.rasterAssetId || input.originalAssetId
      const [raster] =
        await tx`SELECT * FROM assets WHERE id=${rasterId} AND project_id=${projectId} AND state='ready'`
      if (
        !raster ||
        !raster.mime.startsWith('image/') ||
        raster.metadata.width !== source.width ||
        raster.metadata.height !== source.height
      ) {
        throw new ApiError(
          422,
          'DIMENSION_MISMATCH',
          'Raster dimensions must match the canonical source metadata',
        )
      }
      await tx`INSERT INTO source_plans(project_id,source_id,original_asset_id,raster_asset_id,page,width,height)
        VALUES (${projectId},${sourceId},${input.originalAssetId},${rasterId},${input.page ?? null},${source.width},${source.height})
        ON CONFLICT(project_id,source_id) DO UPDATE SET original_asset_id=EXCLUDED.original_asset_id,raster_asset_id=EXCLUDED.raster_asset_id,
        page=EXCLUDED.page,width=EXCLUDED.width,height=EXCLUDED.height`
    })
    return context.body(null, 204)
  })
  return routes
}
