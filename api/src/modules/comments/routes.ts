import { Hono } from 'hono'
import { z } from 'zod'
import type { Database } from '../../db/connection'
import type { ApiEnv } from '../../middleware/types'
import { body, param, parse } from '../../contracts/http'
import { pagination } from '../../contracts/primitives'
import { commentSchema } from '../../contracts/review'
import { authorize } from '../../security/permissions'
import { newId } from '../../security/tokens'
import { ApiError } from '../../security/errors'
import { emit } from '../audit/service'
import { validateAnchor } from './anchors'

export function commentRoutes(db: Database) {
  const routes = new Hono<ApiEnv>()
  routes.get('/:projectId/comments', async context => {
    const projectId = param(context, 'projectId')
    await authorize(db, context.get('actor'), projectId)
    const query = parse(pagination, context.req.query())
    const rows = await db`SELECT * FROM comments WHERE project_id=${projectId} AND id>${query.cursor || ''} ORDER BY id LIMIT ${query.limit + 1}`
    return context.json({ items: rows.slice(0, query.limit), nextCursor: rows.length > query.limit ? rows[query.limit - 1].id : null })
  })
  routes.post('/:projectId/comments', async context => {
    const input = await body(context, commentSchema), projectId = param(context, 'projectId'), actor = context.get('actor')
    const result = await db.begin(async tx => {
      await authorize(tx, actor, projectId, 'review')
      await validateAnchor(tx, projectId, input.anchor)
      if (input.parentId) {
        const [parent] = await tx`SELECT 1 FROM comments WHERE id=${input.parentId} AND project_id=${projectId}`
        if (!parent) throw new ApiError(422, 'INVALID_PARENT', 'Parent comment is not part of this project')
      }
      for (const userId of input.mentions) await authorize(tx, { ...actor, id: userId }, projectId)
      const [comment] = await tx`INSERT INTO comments(id,project_id,actor_id,parent_id,text,anchor,mentions)
        VALUES (${newId('comment')},${projectId},${actor.id},${input.parentId ?? null},${input.text},${input.anchor}::jsonb,${tx.array(input.mentions,'TEXT')}) RETURNING *`
      await emit(tx, projectId, 'comment.created', comment)
      return comment
    })
    return context.json(result, 201)
  })
  routes.patch('/:projectId/comments/:commentId', async context => {
    const projectId = param(context, 'projectId'), commentId = param(context, 'commentId'), actor = context.get('actor')
    const input = await body(context, z.object({ resolved: z.boolean() }).strict())
    await db.begin(async tx => {
      await authorize(tx, actor, projectId, 'review')
      const rows = await tx`UPDATE comments SET resolved_at=CASE WHEN ${input.resolved} THEN now() ELSE NULL END,
        resolved_by=CASE WHEN ${input.resolved} THEN ${actor.id} ELSE NULL END WHERE id=${commentId} AND project_id=${projectId} RETURNING *`
      if (!rows.length) throw new ApiError(404, 'NOT_FOUND', 'Comment not found')
      await emit(tx, projectId, 'comment.updated', rows[0])
    })
    return context.body(null, 204)
  })
  return routes
}
