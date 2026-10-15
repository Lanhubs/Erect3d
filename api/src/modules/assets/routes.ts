import { Hono } from 'hono'
import { z } from 'zod'
import type { Database } from '../../db/connection'
import type { Config } from '../../config/env'
import type { ApiEnv } from '../../middleware/types'
import type { ObjectStore } from '../../storage/objects'
import { requireStore } from '../../storage/objects'
import { body, param, parse } from '../../contracts/http'
import { id, name, pagination } from '../../contracts/primitives'
import { authorize } from '../../security/permissions'
import { ApiError, requireValue } from '../../security/errors'
import { newId } from '../../security/tokens'
import { validateAsset, bytesHash } from './validation'
import { enqueue } from '../../jobs/queue'
import { optimizeAsset } from './optimize'

export function assetRoutes(db: Database, config: Config, store?: ObjectStore) {
  const routes = new Hono<ApiEnv>()
  routes.post('/:projectId/assets/uploads', async context => {
    const projectId = param(context, 'projectId'), actor = context.get('actor')
    await authorize(db, actor, projectId, 'edit')
    const input = await body(context, z.object({ name, mime: z.enum(['image/png', 'image/jpeg', 'application/pdf']),
      size: z.number().int().positive().max(config.MAX_UPLOAD_BYTES),
      kind: z.enum(['source', 'raster', 'thumbnail', 'screenshot', 'component']), parentId: id.optional() }).strict())
    const storage = requireStore(store), assetId = newId('asset'), key = `staging/${projectId}/${assetId}/${crypto.randomUUID()}`
    if (input.parentId) {
      const [parent] = await db`SELECT 1 FROM assets WHERE id=${input.parentId} AND project_id=${projectId} AND state='ready'`
      requireValue(parent)
    }
    if (input.mime === 'application/pdf' && input.kind !== 'source') throw new ApiError(422, 'INVALID_CATEGORY', 'PDF is an original source document')
    await db.begin(async tx=>{
      await tx`INSERT INTO assets(id,project_id,actor_id,object_key,name,mime,size,kind,parent_id)
        VALUES (${assetId},${projectId},${actor.id},${key},${input.name},${input.mime},${input.size},${input.kind},${input.parentId ?? null})`
      await enqueue(tx,actor,projectId,'asset.purge',{ key,pendingAssetId:assetId },context.get('requestId'),3600)
    })
    return context.json({ assetId, uploadUrl: storage.uploadUrl(key, input.mime), expiresIn: 300, requiredHeaders: { 'Content-Type': input.mime } }, 201)
  })
  routes.post('/:projectId/assets/:assetId/finalize', async context => {
    const projectId = param(context, 'projectId'), assetId = param(context, 'assetId'), actor = context.get('actor')
    await authorize(db, actor, projectId, 'edit')
    const storage = requireStore(store)
    const [asset] = await db`SELECT * FROM assets WHERE id=${assetId} AND project_id=${projectId}`
    requireValue(asset)
    if (asset.state === 'ready') return context.json({ assetId, state: 'ready', sha256: asset.sha256 })
    if (asset.state !== 'pending') throw new ApiError(409, 'ASSET_STATE', 'Asset cannot be finalized')
    const stat = await storage.stat(asset.object_key)
    if (stat.size !== Number(asset.size) || stat.size > config.MAX_UPLOAD_BYTES) throw new ApiError(422, 'SIZE_MISMATCH', 'Uploaded size differs from the authorized size')
    const bytes = await storage.read(asset.object_key, Number(asset.size))
    if (bytes.length !== Number(asset.size)) throw new ApiError(422, 'SIZE_MISMATCH', 'Upload is incomplete')
    const metadata = await validateAsset(bytes, asset.mime, asset.kind)
    const { bytes:content,...optimization } = await optimizeAsset(bytes,asset.mime,config), sha256 = bytesHash(bytes)
    // Keep compact validated bytes at a fresh private key; the signed upload cannot overwrite it.
    const finalKey = `private/${projectId}/${assetId}/${crypto.randomUUID()}${optimization.method==='lossless-zip'?'.zip':''}`
    await storage.write(finalKey, content, optimization.method==='lossless-zip'?'application/zip':asset.mime)
    try {
      await db.begin(async tx => {
        await authorize(tx, actor, projectId, 'edit')
        const [current] = await tx`SELECT state FROM assets WHERE id=${assetId} FOR UPDATE`
        if (current.state !== 'pending') throw new ApiError(409, 'ASSET_STATE', 'Asset was finalized concurrently')
        await tx`UPDATE assets SET state='ready',object_key=${finalKey},sha256=${sha256},size=${content.length},metadata=${{ ...metadata,optimization }}::jsonb WHERE id=${assetId}`
        await enqueue(tx, actor, projectId, 'asset.purge', { key: asset.object_key }, context.get('requestId'), 600)
        if (asset.mime.startsWith('image/')) await enqueue(tx, actor, projectId, 'asset.normalize', { assetId }, context.get('requestId'))
      })
    } catch (error) { await storage.delete(finalKey); throw error }
    return context.json({ assetId, state: 'ready', sha256, metadata,optimization })
  })
  routes.get('/:projectId/assets', async context => {
    const projectId = param(context, 'projectId')
    await authorize(db, context.get('actor'), projectId)
    const query = parse(pagination, context.req.query())
    const rows = await db`SELECT id,name,mime,size,kind,state,sha256,metadata,parent_id FROM assets
      WHERE project_id=${projectId} AND deleted_at IS NULL AND id>${query.cursor || ''} ORDER BY id LIMIT ${query.limit + 1}`
    return context.json({ items: rows.slice(0, query.limit), nextCursor: rows.length > query.limit ? rows[query.limit - 1].id : null })
  })
  routes.get('/:projectId/assets/:assetId/download', async context => {
    const projectId = param(context, 'projectId'), assetId = param(context, 'assetId')
    await authorize(db, context.get('actor'), projectId)
    const [asset] = await db`SELECT object_key FROM assets WHERE id=${assetId} AND project_id=${projectId} AND state='ready'`
    return context.json({ downloadUrl: requireStore(store).downloadUrl(requireValue(asset).object_key), expiresIn: 120 })
  })
  routes.delete('/:projectId/assets/:assetId', async context => {
    const projectId = param(context, 'projectId'), assetId = param(context, 'assetId'), actor = context.get('actor')
    await db.begin(async tx => {
      await authorize(tx, actor, projectId, 'edit')
      const [asset] = await tx`UPDATE assets SET state='deleted',deleted_at=now() WHERE id=${assetId} AND project_id=${projectId} AND state<>'deleted' RETURNING object_key`
      requireValue(asset)
      await enqueue(tx, actor, projectId, 'asset.purge', { key: asset.object_key }, context.get('requestId'))
    })
    return context.body(null, 204)
  })
  return routes
}
