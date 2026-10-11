import { Hono } from 'hono'
import { z } from 'zod'
import type { Database } from '../../db/connection'
import type { ApiEnv } from '../../middleware/types'
import { body,param,parse } from '../../contracts/http'
import { id,pagination } from '../../contracts/primitives'
import { authorize } from '../../security/permissions'
import { newId,token,digest } from '../../security/tokens'
import { ApiError } from '../../security/errors'
import { audit } from '../audit/service'
export const shareSchema = z.object({ scope:z.enum(['VIEW','COMMENT','APPROVE']),
  versionId:id.optional(),expiresInSeconds:z.number().int().min(60).max(2592000).default(604800) }).strict()
export function shareRoutes(db: Database) {
  const routes = new Hono<ApiEnv>()
  routes.get('/:projectId/shares',async context => {
    const projectId = param(context,'projectId')
    await authorize(db,context.get('actor'),projectId,'manage')
    const query = parse(pagination,context.req.query())
    return context.json(await db`SELECT id,scope,version_id,expires_at,revoked_at,created_at FROM shares
      WHERE project_id=${projectId} AND id>${query.cursor || ''} ORDER BY id LIMIT ${query.limit}`)
  })
  routes.post('/:projectId/shares',async context => {
    const input = await body(context,shareSchema),projectId = param(context,'projectId'),actor = context.get('actor')
    if (input.scope==='APPROVE' && !input.versionId) throw new ApiError(422,'VERSION_REQUIRED','Approval links must pin an immutable version')
    const raw = token(),shareId = newId('share')
    await db.begin(async tx => {
      await authorize(tx,actor,projectId,'manage')
      if (input.versionId) {
        const [version] = await tx`SELECT 1 FROM versions WHERE id=${input.versionId} AND project_id=${projectId}`
        if (!version) throw new ApiError(422,'INVALID_VERSION','Version is not part of this project')
      }
      await tx`INSERT INTO shares(id,project_id,actor_id,token_hash,scope,version_id,expires_at)
        VALUES (${shareId},${projectId},${actor.id},${digest(raw)},${input.scope},${input.versionId ?? null},now()+${input.expiresInSeconds}*interval '1 second')`
      await audit(tx,actor,projectId,'share.created',context.get('requestId'),{ shareId,scope:input.scope })
    })
    return context.json({ id:shareId,token:raw,scope:input.scope,expiresInSeconds:input.expiresInSeconds },201)
  })
  routes.delete('/:projectId/shares/:shareId',async context => {
    const projectId = param(context,'projectId'),shareId = param(context,'shareId'),actor = context.get('actor')
    await db.begin(async tx => {
      await authorize(tx,actor,projectId,'manage')
      await tx`UPDATE shares SET revoked_at=now() WHERE id=${shareId} AND project_id=${projectId}`
      await audit(tx,actor,projectId,'share.revoked',context.get('requestId'),{ shareId })
    })
    return context.body(null,204)
  })
  return routes
}
