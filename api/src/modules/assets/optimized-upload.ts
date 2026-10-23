import { Hono } from 'hono'
import { z } from 'zod'
import { bodyLimit } from 'hono/body-limit'
import type { Database } from '../../db/connection'
import type { Config } from '../../config/env'
import type { ApiEnv } from '../../middleware/types'
import type { ObjectStore } from '../../storage/objects'
import { requireStore } from '../../storage/objects'
import { parse, param } from '../../contracts/http'
import { name } from '../../contracts/primitives'
import { authorize } from '../../security/permissions'
import { idempotent } from '../../security/idempotency'
import { newId } from '../../security/tokens'
import { ApiError } from '../../security/errors'
import { bytesHash, validateAsset } from './validation'
import { optimizeAsset } from './optimize'
import { enqueue } from '../../jobs/queue'
const inputSchema = z
  .object({
    name,
    kind: z.enum(['source', 'raster']),
    mime: z.enum(['image/png', 'image/jpeg', 'application/pdf']),
  })
  .strict()
let active = 0
export function optimizedUploadRoutes(db: Database, config: Config, store?: ObjectStore) {
  const routes = new Hono<ApiEnv>()
  routes.use('/:projectId/assets/optimized-upload', async (context, next) => {
    await authorize(db, context.get('actor'), param(context, 'projectId'), 'edit')
    return bodyLimit({
      maxSize: config.MAX_UPLOAD_BYTES,
      onError: (context) =>
        context.json(
          { error: { code: 'ASSET_TOO_LARGE', message: 'Upload exceeds its permitted size' } },
          413,
        ),
    })(context, next)
  })
  routes.post('/:projectId/assets/optimized-upload', async (context) => {
    const actor = context.get('actor'),
      projectId = param(context, 'projectId'),
      input = parse(inputSchema, context.req.query()),
      storage = requireStore(store)
    await authorize(db, actor, projectId, 'edit')
    if (context.req.header('Content-Type') !== input.mime)
      throw new ApiError(422, 'MIME_MISMATCH', 'Upload content type must match its declared format')
    if (active >= 2)
      throw new ApiError(429, 'OPTIMIZER_BUSY', 'Upload processing is busy; retry the same upload shortly')
    active++
    try {
      const bytes = new Uint8Array(await context.req.arrayBuffer())
      if (!bytes.length || bytes.length > config.MAX_UPLOAD_BYTES)
        throw new ApiError(413, 'ASSET_TOO_LARGE', 'Upload exceeds its permitted size')
      const metadata = await validateAsset(bytes, input.mime, input.kind),
        hash = bytesHash(bytes)
      let writtenKey: string | undefined
      try {
        return context.json(
          await idempotent(
            db,
            actor.id,
            `optimized-upload:${projectId}`,
            context.req.header('Idempotency-Key'),
            { ...input, hash },
            async (tx) => {
              await authorize(tx, actor, projectId, 'edit')
              const optimized = await optimizeAsset(bytes, input.mime, config),
                assetId = newId('asset'),
                key = `private/${projectId}/${assetId}/${crypto.randomUUID()}${optimized.method === 'lossless-zip' ? '.zip' : ''}`
              const { bytes: content, ...optimization } = optimized
              await storage.write(
                key,
                content,
                optimization.method === 'lossless-zip' ? 'application/zip' : input.mime,
              )
              writtenKey = key
              await tx`INSERT INTO assets(id,project_id,actor_id,object_key,name,mime,size,kind,state,sha256,metadata)
            VALUES (${assetId},${projectId},${actor.id},${key},${input.name},${input.mime},${content.length},${input.kind},'ready',${hash},${{ ...metadata, optimization }}::jsonb)`
              if (input.kind === 'source' && input.mime.startsWith('image/'))
                await enqueue(tx, actor, projectId, 'asset.normalize', { assetId }, context.get('requestId'))
              return { assetId, state: 'ready', metadata, optimization }
            },
          ),
          201,
        )
      } catch (error) {
        if (writtenKey) await storage.delete(writtenKey)
        throw error
      }
    } finally {
      active--
    }
  })
  return routes
}
