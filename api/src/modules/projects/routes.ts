import { Hono } from 'hono'
import { z } from 'zod'
import type { ApiEnv } from '../../middleware/types'
import type { Database } from '../../db/connection'
import type { Config } from '../../config/env'
import { projectSchema } from '../../contracts/project'
import { operationSchema } from '../../contracts/operations'
import { body, param, parse } from '../../contracts/http'
import { id, pagination } from '../../contracts/primitives'
import { authorize, teamPermission } from '../../security/permissions'
import { idempotent } from '../../security/idempotency'
import { audit } from '../audit/service'
import { saveSnapshot, loadDocument } from './documents'
import { validateGeometry } from './geometry-validation'
import { commitOperation } from './operations'
import { ApiError } from '../../security/errors'
import { readOperations } from './history'
import { validateDocumentSize } from './size'
import { planPreviews } from './plan-preview'
export const createProjectSchema = z.object({ document: projectSchema, teamId: id.optional() }).strict()

export function projectRoutes(db: Database, config: Config) {
  const routes = new Hono<ApiEnv>()
  const preview = planPreviews(db)
  routes.get('/:projectId/plan-preview', async (context) => {
    const projectId = param(context, 'projectId'),
      result = await preview(context.get('actor'), projectId)
    const etag = `"plan-${projectId}-${result.revision}"`
    context.header('Cache-Control', 'private, no-cache')
    context.header('ETag', etag)
    if (context.req.header('If-None-Match') === etag) return context.body(null, 304)
    return context.json(result)
  })
  routes.post('/', async (context) => {
    const input = await body(context, createProjectSchema)
    validateDocumentSize(input.document, config.MAX_PROJECT_BYTES)
    validateGeometry(input.document)
    const actor = context.get('actor')
    const result = await idempotent(
      db,
      actor.id,
      'project.create',
      context.req.header('Idempotency-Key'),
      input,
      async (tx) => {
        if (input.teamId) {
          const role = await teamPermission(tx, actor, input.teamId)
          if (!['OWNER', 'EDITOR'].includes(role))
            throw new ApiError(403, 'FORBIDDEN', 'Team project creation requires an editor role')
        }
        await tx`INSERT INTO projects(id,owner_id,team_id,name) VALUES (${input.document.id},${actor.id},${input.teamId ?? null},${input.document.name})`
        await saveSnapshot(tx, input.document.id, 0, input.document)
        await audit(tx, actor, input.document.id, 'project.created', context.get('requestId'))
        return { projectId: input.document.id, revision: 0 }
      },
    )
    return context.json(result, 201)
  })
  routes.get('/', async (context) => {
    const { cursor, limit } = parse(pagination, context.req.query()),
      actor = context.get('actor')
    const rows = await db`SELECT p.id,p.name,p.revision,p.modified_at,p.team_id FROM projects p
      WHERE p.deleted_at IS NULL AND p.id>${cursor || ''} AND (p.team_id IS NULL AND p.owner_id=${actor.id}
      OR EXISTS(SELECT 1 FROM project_members pm WHERE pm.project_id=p.id AND pm.user_id=${actor.id})
      OR EXISTS(SELECT 1 FROM team_members tm WHERE tm.team_id=p.team_id AND tm.user_id=${actor.id})) ORDER BY p.id LIMIT ${limit + 1}`
    return context.json({
      items: rows.slice(0, limit),
      nextCursor: rows.length > limit ? rows[limit - 1].id : null,
    })
  })
  routes.get('/:projectId', async (context) => {
    const projectId = param(context, 'projectId')
    const access = await authorize(db, context.get('actor'), projectId)
    const snapshot = await loadDocument(db, projectId)
    const etag = `"${snapshot.checksum}"`
    context.header('ETag', etag)
    context.header('Cache-Control', 'private, no-cache')
    if (context.req.header('If-None-Match') === etag) return context.body(null, 304)
    return context.json({ ...snapshot, role: access.role, allowClientApproval: access.allow_client_approval })
  })
  routes.post('/:projectId/operations', async (context) =>
    context.json(
      await commitOperation(
        db,
        config,
        context.get('actor'),
        param(context, 'projectId'),
        await body(context, operationSchema),
      ),
    ),
  )
  routes.get('/:projectId/operations', async (context) => {
    const projectId = param(context, 'projectId')
    const project = await authorize(db, context.get('actor'), projectId)
    const query = parse(
      z
        .object({
          after: z.coerce.number().int().nonnegative().default(0),
          limit: z.coerce.number().int().min(1).max(200).default(100),
        })
        .strict(),
      context.req.query(),
    )
    const rows = await readOperations(db, projectId, query.after, query.limit, Number(project.revision))
    const nextRevision = Number(rows.at(-1)?.revision ?? query.after)
    return context.json({
      items: rows,
      nextRevision,
      currentRevision: Number(project.revision),
      hasMore: nextRevision < Number(project.revision),
    })
  })
  routes.delete('/:projectId', async (context) => {
    const projectId = param(context, 'projectId'),
      actor = context.get('actor')
    await db.begin(async (tx) => {
      await tx`SELECT id FROM projects WHERE id=${projectId} FOR UPDATE`
      await authorize(tx, actor, projectId, 'manage')
      await tx`UPDATE projects SET deleted_at=now() WHERE id=${projectId}`
      await tx`UPDATE shares SET revoked_at=now() WHERE project_id=${projectId}`
      await tx`UPDATE jobs SET status='cancelled',completed_at=now() WHERE project_id=${projectId} AND status IN ('queued','running')`
      await audit(tx, actor, projectId, 'project.deleted', context.get('requestId'))
    })
    return context.body(null, 204)
  })
  routes.post('/:projectId/recover', async (context) => {
    const projectId = param(context, 'projectId'),
      actor = context.get('actor')
    await db.begin(async (tx) => {
      await authorize(tx, actor, projectId, 'manage', true)
      await tx`UPDATE projects SET deleted_at=NULL WHERE id=${projectId}`
      await audit(tx, actor, projectId, 'project.recovered', context.get('requestId'))
    })
    return context.json({ projectId })
  })
  return routes
}
