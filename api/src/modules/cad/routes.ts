import { Hono } from 'hono'
import { z } from 'zod'
import type { Database } from '../../db/connection'
import type { Config } from '../../config/env'
import type { ApiEnv } from '../../middleware/types'
import type { ObjectStore } from '../../storage/objects'
import { requireStore } from '../../storage/objects'
import { body, param } from '../../contracts/http'
import { id } from '../../contracts/primitives'
import { authorize } from '../../security/permissions'
import { ApiError } from '../../security/errors'
import { idempotent } from '../../security/idempotency'
import { enqueue } from '../../jobs/queue'
import { cadMimeToFormat } from './signature'
import { cadCapabilities } from './capabilities'

const convertSchema = z.object({ sourceId: id, assetId: id }).strict()

export function cadRoutes(db: Database, config: Config, store?: ObjectStore) {
  const routes = new Hono<ApiEnv>()
  routes.post('/:projectId/cad/convert', async (context) => {
    const projectId = param(context, 'projectId'),
      actor = context.get('actor'),
      input = await body(context, convertSchema)
    requireStore(store)
    const result = await idempotent(
      db,
      actor.id,
      `cad.convert:${projectId}`,
      context.req.header('Idempotency-Key'),
      input,
      async (tx) => {
        await authorize(tx, actor, projectId, 'edit')
        const [asset] =
          await tx`SELECT mime,kind FROM assets WHERE id=${input.assetId} AND project_id=${projectId} AND state='ready'`
        const format = asset ? cadMimeToFormat(asset.mime) : null
        if (!format || asset.kind !== 'source')
          throw new ApiError(422, 'INVALID_ASSET', 'Upload a DWG or DXF source before converting it')
        if (format === 'dwg' && !(await cadCapabilities(config)).dwgImport)
          throw new ApiError(
            503,
            'DWG_CONVERTER_UNAVAILABLE',
            'DWG needs a server-side converter; re-export the drawing as DXF',
          )
        const [linked] =
          await tx`SELECT raster_asset_id,width,height FROM source_plans WHERE project_id=${projectId} AND source_id=${input.sourceId} AND original_asset_id=${input.assetId}`
        if (linked?.raster_asset_id)
          return {
            jobId: null,
            rasterAssetId: linked.raster_asset_id,
            width: linked.width,
            height: linked.height,
          }
        return {
          jobId: await enqueue(tx, actor, projectId, 'cad.convert', input, context.get('requestId'), 0, 1),
          format,
        }
      },
    )
    return context.json(result, 202)
  })
  return routes
}
