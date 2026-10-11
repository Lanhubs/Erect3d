import { Hono } from 'hono'
import { z } from 'zod'
import type { Database } from '../../db/connection'
import type { ApiEnv } from '../../middleware/types'
import type { RateLimiter } from '../../security/rate-limit'
import { body,parse } from '../../contracts/http'
import { id,name } from '../../contracts/primitives'
import { digest,newId } from '../../security/tokens'
import { ApiError } from '../../security/errors'
import { loadDocument } from '../projects/documents'
import { audit,emit } from '../audit/service'
import { validateAnchor } from '../comments/anchors'
import { anchorSchema } from '../../contracts/review'
export const guestCommentSchema = z.object({ author:name,text:z.string().trim().min(1).max(10000),anchor:anchorSchema,parentId:id.optional() }).strict()
export const guestApprovalSchema = z.object({ author:name,decision:z.enum(['APPROVED','CHANGES_REQUESTED']),note:z.string().max(10000) }).strict()
async function resolve(db: Database,raw: string | undefined,scope = 'VIEW') {
  const token = parse(z.string().length(43).regex(/^[a-zA-Z0-9_-]+$/),raw)
  if (scope !== 'VIEW') {
    const [target] = await db`SELECT project_id FROM shares WHERE token_hash=${digest(token)}`
    if (target) await db`SELECT id FROM projects WHERE id=${target.project_id} FOR UPDATE`
    await db`SELECT id FROM shares WHERE token_hash=${digest(token)} FOR UPDATE`
  }
  const [share] = await db`SELECT s.*,v.revision FROM shares s JOIN projects p ON p.id=s.project_id
    LEFT JOIN versions v ON v.id=s.version_id WHERE s.token_hash=${digest(token)}
    AND s.revoked_at IS NULL AND s.expires_at>now() AND p.deleted_at IS NULL`
  if (!share) throw new ApiError(404,'SHARE_UNAVAILABLE','Share link is unavailable')
  if (scope==='COMMENT' && share.scope==='VIEW' || scope==='APPROVE' && share.scope!=='APPROVE') {
    throw new ApiError(403,'SHARE_SCOPE','This link does not permit this action')
  }
  return share
}
export function publicShareRoutes(db: Database,limits: RateLimiter) {
  const routes = new Hono<ApiEnv>()
  routes.use('/:token/*',async (context,next) => {
    await limits.consume(`share:${digest(context.req.param('token') || '')}`,100,60)
    await next()
  })
  routes.get('/:token',async context => {
    const share = await resolve(db,context.req.param('token'))
    const snapshot = await loadDocument(db,share.project_id,share.revision === null ? undefined : Number(share.revision))
    // Shared presentations expose architecture, not private source names or source-file download links.
    snapshot.document.sources = []
    snapshot.document.buildings.forEach(building => building.levels.forEach(level => { delete level.sourceId; delete level.calibration }))
    delete snapshot.document.calibration
    return context.json({ ...snapshot,checksum:undefined,scope:share.scope,versionId:share.version_id })
  })
  routes.post('/:token/comments',async context => {
    const input = await body(context,guestCommentSchema)
    const comment = await db.begin(async tx => {
      const share = await resolve(tx,context.req.param('token'),'COMMENT')
      await validateAnchor(tx,share.project_id,input.anchor,share.revision===null?undefined:Number(share.revision))
      if (input.parentId) {
        const [parent] = await tx`SELECT 1 FROM comments WHERE id=${input.parentId} AND project_id=${share.project_id} AND share_id=${share.id}`
        if (!parent) throw new ApiError(422,'INVALID_PARENT','Reply target is not available through this share')
      }
      const [row] = await tx`INSERT INTO comments(id,project_id,actor_id,share_id,author_label,parent_id,text,anchor)
        VALUES (${newId('comment')},${share.project_id},NULL,${share.id},${input.author},${input.parentId ?? null},${input.text},${input.anchor}::jsonb) RETURNING *`
      await emit(tx,share.project_id,'comment.created',row)
      await audit(tx,null,share.project_id,'share.comment_created',context.get('requestId'),{ shareId:share.id,commentId:row.id })
      return { id:row.id }
    })
    return context.json(comment,201)
  })
  routes.post('/:token/approvals',async context => {
    const input = await body(context,guestApprovalSchema)
    const result = await db.begin(async tx => {
      const share = await resolve(tx,context.req.param('token'),'APPROVE')
      const [row] = await tx`INSERT INTO approvals(id,project_id,actor_id,share_id,author_label,version_id,decision,note,project_revision)
        VALUES (${newId('approval')},${share.project_id},NULL,${share.id},${input.author},${share.version_id},${input.decision},${input.note},${Number(share.revision)}) RETURNING id`
      await audit(tx,null,share.project_id,'share.approval_recorded',context.get('requestId'),{ shareId:share.id,approvalId:row.id })
      await emit(tx,share.project_id,'approval.created',{ id:row.id,shareId:share.id,decision:input.decision })
      return row
    })
    return context.json(result,201)
  })
  return routes
}
