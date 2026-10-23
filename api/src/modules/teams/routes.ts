import { Hono } from 'hono'
import { z } from 'zod'
import type { Database } from '../../db/connection'
import type { ApiEnv } from '../../middleware/types'
import { body, param, parse } from '../../contracts/http'
import { id, name, pagination } from '../../contracts/primitives'
import { teamPermission } from '../../security/permissions'
import { ApiError, requireValue } from '../../security/errors'
import { newId } from '../../security/tokens'
import { audit } from '../audit/service'
import { invitationRoutes } from './invitations'

const memberRole = z.enum(['EDITOR', 'REVIEWER', 'CLIENT', 'VIEWER'])
export function teamRoutes(db: Database) {
  const routes = new Hono<ApiEnv>()
  routes.route('/', invitationRoutes(db))
  routes.get('/', async (context) => {
    const actor = context.get('actor'),
      query = parse(pagination, context.req.query())
    return context.json(
      await db`SELECT t.id,t.name,m.role FROM teams t JOIN team_members m ON m.team_id=t.id
      WHERE m.user_id=${actor.id} AND t.id>${query.cursor || ''} ORDER BY t.id LIMIT ${query.limit}`,
    )
  })
  routes.post('/', async (context) => {
    const input = await body(context, z.object({ name }).strict()),
      actor = context.get('actor'),
      teamId = newId('team')
    await db.begin(async (tx) => {
      await tx`INSERT INTO teams(id,name,owner_id) VALUES (${teamId},${input.name},${actor.id})`
      await tx`INSERT INTO team_members(team_id,user_id,role) VALUES (${teamId},${actor.id},'OWNER')`
      await audit(tx, actor, null, 'team.created', context.get('requestId'), { teamId })
    })
    return context.json({ id: teamId, name: input.name }, 201)
  })
  routes.get('/:teamId/members', async (context) => {
    const teamId = param(context, 'teamId')
    await teamPermission(db, context.get('actor'), teamId)
    const query = parse(pagination, context.req.query())
    return context.json(
      await db`SELECT u.id,u.name,u.email,m.role FROM team_members m JOIN users u ON u.id=m.user_id
      WHERE m.team_id=${teamId} AND u.id>${query.cursor || ''} ORDER BY u.id LIMIT ${query.limit}`,
    )
  })
  routes.patch('/:teamId/members/:userId', async (context) => {
    const teamId = param(context, 'teamId'),
      userId = param(context, 'userId'),
      actor = context.get('actor')
    const input = await body(context, z.object({ role: memberRole }).strict())
    await db.begin(async (tx) => {
      await tx`SELECT id FROM teams WHERE id=${teamId} FOR UPDATE`
      await teamPermission(tx, actor, teamId, true)
      const [member] = await tx`SELECT role FROM team_members WHERE team_id=${teamId} AND user_id=${userId}`
      await tx`SELECT id FROM projects WHERE team_id=${teamId} ORDER BY id FOR UPDATE`
      if (requireValue(member).role === 'OWNER')
        throw new ApiError(
          409,
          'OWNER_TRANSFER_REQUIRED',
          'Transfer ownership before changing the owner role',
        )
      await tx`UPDATE team_members SET role=${input.role} WHERE team_id=${teamId} AND user_id=${userId}`
      await audit(tx, actor, null, 'team.role_changed', context.get('requestId'), {
        teamId,
        userId,
        role: input.role,
      })
    })
    return context.body(null, 204)
  })
  routes.post('/:teamId/transfer', async (context) => {
    const teamId = param(context, 'teamId'),
      actor = context.get('actor')
    const input = await body(context, z.object({ userId: id }).strict())
    await db.begin(async (tx) => {
      await tx`SELECT id FROM teams WHERE id=${teamId} FOR UPDATE`
      await teamPermission(tx, actor, teamId, true)
      const [member] =
        await tx`SELECT 1 FROM team_members WHERE team_id=${teamId} AND user_id=${input.userId}`
      await tx`SELECT id FROM projects WHERE team_id=${teamId} ORDER BY id FOR UPDATE`
      requireValue(member)
      await tx`UPDATE team_members SET role='EDITOR' WHERE team_id=${teamId} AND role='OWNER'`
      await tx`UPDATE team_members SET role='OWNER' WHERE team_id=${teamId} AND user_id=${input.userId}`
      await tx`UPDATE teams SET owner_id=${input.userId} WHERE id=${teamId}`
      await audit(tx, actor, null, 'team.ownership_transferred', context.get('requestId'), {
        teamId,
        userId: input.userId,
      })
    })
    return context.body(null, 204)
  })
  routes.delete('/:teamId/members/:userId', async (context) => {
    const teamId = param(context, 'teamId'),
      userId = param(context, 'userId'),
      actor = context.get('actor')
    await db.begin(async (tx) => {
      await tx`SELECT id FROM teams WHERE id=${teamId} FOR UPDATE`
      await teamPermission(tx, actor, teamId, true)
      await tx`SELECT id FROM projects WHERE team_id=${teamId} ORDER BY id FOR UPDATE`
      const [member] = await tx`SELECT role FROM team_members WHERE team_id=${teamId} AND user_id=${userId}`
      if (requireValue(member).role === 'OWNER')
        throw new ApiError(409, 'OWNER_TRANSFER_REQUIRED', 'Transfer ownership before removing the owner')
      await tx`DELETE FROM team_members WHERE team_id=${teamId} AND user_id=${userId}`
      await tx`DELETE FROM project_members m USING projects p WHERE m.project_id=p.id AND p.team_id=${teamId} AND m.user_id=${userId}`
      await audit(tx, actor, null, 'team.member_removed', context.get('requestId'), { teamId, userId })
    })
    return context.body(null, 204)
  })
  return routes
}
