import { Hono } from 'hono'
import { z } from 'zod'
import type { Database } from '../../db/connection'
import type { ApiEnv } from '../../middleware/types'
import { body, param, parse } from '../../contracts/http'
import { id, pagination } from '../../contracts/primitives'
import { issueSchema } from '../../contracts/review'
import { authorize } from '../../security/permissions'
import { ApiError } from '../../security/errors'
import { newId } from '../../security/tokens'
import { audit, emit } from '../audit/service'
import { validateAnchor } from '../comments/anchors'
const transitions: Record<string, string[]> = { OPEN: ['IN_PROGRESS', 'RESOLVED'], IN_PROGRESS: ['OPEN', 'RESOLVED'],
  RESOLVED: ['IN_PROGRESS', 'CLOSED'], CLOSED: ['OPEN'] }
export function issueRoutes(db: Database) {
  const routes = new Hono<ApiEnv>()
  routes.get('/:projectId/issues', async context => {
    const projectId = param(context, 'projectId')
    await authorize(db, context.get('actor'), projectId)
    const query = parse(pagination, context.req.query())
    const rows = await db`SELECT * FROM issues WHERE project_id=${projectId} AND id>${query.cursor || ''} ORDER BY id LIMIT ${query.limit + 1}`
    return context.json({ items: rows.slice(0, query.limit), nextCursor: rows.length > query.limit ? rows[query.limit - 1].id : null })
  })
  routes.post('/:projectId/issues', async context => {
    const input = await body(context, issueSchema), projectId = param(context, 'projectId'), actor = context.get('actor')
    const issue = await db.begin(async tx => {
      await authorize(tx, actor, projectId, 'review')
      await validateAnchor(tx, projectId, input.anchor)
      if (input.assigneeId) await authorize(tx, { ...actor, id: input.assigneeId }, projectId)
      if (input.commentId) {
        const [comment] = await tx`SELECT id FROM comments WHERE id=${input.commentId} AND project_id=${projectId}`
        if (!comment) throw new ApiError(422,'INVALID_COMMENT','Comment is not part of this project')
      }
      const [row] = await tx`INSERT INTO issues(id,project_id,actor_id,title,description,anchor,assignee_id,priority,comment_id)
        VALUES (${newId('issue')},${projectId},${actor.id},${input.title},${input.description},${input.anchor}::jsonb,${input.assigneeId ?? null},${input.priority},${input.commentId ?? null}) RETURNING *`
      await emit(tx, projectId, 'issue.updated', row)
      await audit(tx, actor, projectId, 'issue.created', context.get('requestId'), { issueId: row.id })
      return row
    })
    return context.json(issue, 201)
  })
  routes.patch('/:projectId/issues/:issueId', async context => {
    const projectId = param(context, 'projectId'), issueId = param(context, 'issueId'), actor = context.get('actor')
    const input = await body(context, z.object({ status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
      assigneeId: id.nullable().optional(),priority:z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).optional() }).strict().refine(value => Object.keys(value).length > 0, 'Supply a change'))
    const issue = await db.begin(async tx => {
      await authorize(tx, actor, projectId, 'review')
      const [row] = await tx`SELECT * FROM issues WHERE id=${issueId} AND project_id=${projectId} FOR UPDATE`
      if (!row) throw new ApiError(404, 'NOT_FOUND', 'Issue not found')
      if (input.status && input.status !== row.status && !transitions[row.status]?.includes(input.status)) {
        throw new ApiError(409, 'INVALID_TRANSITION', 'Issue state transition is not allowed')
      }
      if (input.assigneeId) await authorize(tx, { ...actor, id: input.assigneeId }, projectId)
      const [updated] = await tx`UPDATE issues SET status=${input.status ?? row.status},
        priority=${input.priority ?? row.priority},resolved_at=CASE WHEN ${input.status ?? row.status} IN ('RESOLVED','CLOSED')
          THEN COALESCE(resolved_at,now()) ELSE NULL END,
        assignee_id=${input.assigneeId === undefined ? row.assignee_id : input.assigneeId},modified_at=now()
        WHERE id=${issueId} RETURNING *`
      await emit(tx, projectId, 'issue.updated', updated)
      await audit(tx, actor, projectId, 'issue.updated', context.get('requestId'), { issueId, status: updated.status })
      return updated
    })
    return context.json(issue)
  })
  return routes
}
