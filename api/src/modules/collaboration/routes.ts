import { Hono } from 'hono'
import { z } from 'zod'
import type { Database } from '../../db/connection'
import type { ApiEnv } from '../../middleware/types'
import { body, param, parse } from '../../contracts/http'
import { id, pagination } from '../../contracts/primitives'
import { authorize } from '../../security/permissions'
import { audit } from '../audit/service'
import { collaboratorEmail, collaboratorRole, grantProjectAccess } from './membership'
export function collaborationRoutes(db: Database) {
  const routes = new Hono<ApiEnv>()
  routes.get('/:projectId/members', async (context) => {
    const projectId = param(context, 'projectId')
    await authorize(db, context.get('actor'), projectId)
    const query = parse(pagination, context.req.query())
    return context.json(
      await db`SELECT u.id,u.name,u.email,pm.role FROM project_members pm JOIN users u ON u.id=pm.user_id
      WHERE pm.project_id=${projectId} AND u.id>${query.cursor || ''} ORDER BY u.id LIMIT ${query.limit}`,
    )
  })
  routes.post('/:projectId/members', async (context) => {
    const projectId = param(context, 'projectId')
    const input = await body(context, collaboratorEmail)
    await grantProjectAccess(
      db,
      context.get('actor'),
      projectId,
      { email: input.email },
      input.role,
      context.get('requestId'),
    )
    return context.body(null, 204)
  })
  routes.put('/:projectId/members/:userId', async (context) => {
    const projectId = param(context, 'projectId'),
      userId = param(context, 'userId'),
      actor = context.get('actor')
    const input = await body(context, z.object({ role: collaboratorRole }).strict())
    await grantProjectAccess(db, actor, projectId, { userId }, input.role, context.get('requestId'))
    return context.body(null, 204)
  })
  routes.delete('/:projectId/members/:userId', async (context) => {
    const projectId = param(context, 'projectId'),
      userId = param(context, 'userId'),
      actor = context.get('actor')
    await db.begin(async (tx) => {
      await tx`SELECT id FROM projects WHERE id=${projectId} FOR UPDATE`
      await authorize(tx, actor, projectId, 'manage')
      await tx`DELETE FROM project_members WHERE project_id=${projectId} AND user_id=${userId}`
      await audit(tx, actor, projectId, 'project.member_removed', context.get('requestId'), { userId })
    })
    return context.body(null, 204)
  })
  routes.post('/:projectId/transfer', async (context) => {
    const projectId = param(context, 'projectId'),
      actor = context.get('actor')
    const input = await body(context, z.object({ userId: id }).strict())
    await db.begin(async (tx) => {
      await tx`SELECT id FROM projects WHERE id=${projectId} FOR UPDATE`
      await authorize(tx, actor, projectId, 'manage')
      await authorize(tx, { ...actor, id: input.userId }, projectId)
      await tx`UPDATE projects SET owner_id=${input.userId} WHERE id=${projectId}`
      await tx`INSERT INTO project_members(project_id,user_id,role) VALUES (${projectId},${actor.id},'EDITOR')
        ON CONFLICT(project_id,user_id) DO UPDATE SET role='EDITOR'`
      await tx`DELETE FROM project_members WHERE project_id=${projectId} AND user_id=${input.userId}`
      await audit(tx, actor, projectId, 'project.ownership_transferred', context.get('requestId'), {
        userId: input.userId,
      })
    })
    return context.body(null, 204)
  })
  routes.patch('/:projectId/settings', async (context) => {
    const projectId = param(context, 'projectId'),
      actor = context.get('actor')
    const input = await body(context, z.object({ allowClientApproval: z.boolean() }).strict())
    await db.begin(async (tx) => {
      await authorize(tx, actor, projectId, 'manage')
      await tx`UPDATE projects SET allow_client_approval=${input.allowClientApproval} WHERE id=${projectId}`
      await audit(tx, actor, projectId, 'project.settings_changed', context.get('requestId'), input)
    })
    return context.body(null, 204)
  })
  return routes
}
