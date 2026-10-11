import { Hono } from 'hono'
import { z } from 'zod'
import type { Database } from '../../db/connection'
import type { ApiEnv } from '../../middleware/types'
import { body, param } from '../../contracts/http'
import { teamPermission } from '../../security/permissions'
import { ApiError } from '../../security/errors'
import { digest, newId, token } from '../../security/tokens'
import { idempotent } from '../../security/idempotency'
import { audit } from '../audit/service'
const invite = z.object({ email: z.email().max(254).transform(value => value.toLowerCase()),
  role: z.enum(['EDITOR', 'REVIEWER', 'CLIENT', 'VIEWER']) }).strict()
export function invitationRoutes(db: Database) {
  const routes = new Hono<ApiEnv>()
  routes.post('/:teamId/invitations', async context => {
    const input = await body(context, invite), teamId = param(context, 'teamId'), actor = context.get('actor')
    await teamPermission(db, actor, teamId, true)
    let invitationToken:string | undefined
    const result = await idempotent(db, actor.id, `invite:${teamId}`, context.req.header('Idempotency-Key'), input, async tx => {
      await teamPermission(tx, actor, teamId, true)
      const id = newId('invite'), raw = token()
      invitationToken=raw
      await tx`INSERT INTO invitations(id,team_id,invited_by,email,role,token_hash,expires_at)
        VALUES (${id},${teamId},${actor.id},${input.email},${input.role},${digest(raw)},now()+interval '7 days')`
      await audit(tx, actor, null, 'team.invited', context.get('requestId'), { teamId, invitationId: id })
      // The caller delivers this token; no email is sent implicitly.
      return { id }
    })
    return context.json({ ...result,token:invitationToken,tokenUnavailable:!invitationToken }, 201)
  })
  routes.post('/invitations/accept', async context => {
    const input = await body(context, z.object({ token: z.string().length(43) }).strict()), actor = context.get('actor')
    const result = await db.begin(async tx => {
      const [invitation] = await tx`SELECT * FROM invitations WHERE token_hash=${digest(input.token)}
        AND expires_at>now() AND revoked_at IS NULL FOR UPDATE`
      if (!invitation || invitation.email !== actor.email || invitation.accepted_at) throw new ApiError(404, 'NOT_FOUND', 'Invitation not available')
      await tx`INSERT INTO team_members(team_id,user_id,role) VALUES (${invitation.team_id},${actor.id},${invitation.role}) ON CONFLICT DO NOTHING`
      await tx`UPDATE invitations SET accepted_at=now() WHERE id=${invitation.id}`
      await audit(tx, actor, null, 'team.invitation_accepted', context.get('requestId'), { teamId: invitation.team_id })
      return { teamId: invitation.team_id }
    })
    return context.json(result)
  })
  routes.delete('/:teamId/invitations/:invitationId', async context => {
    const teamId = param(context, 'teamId'), invitationId = param(context, 'invitationId'), actor = context.get('actor')
    await db.begin(async tx => {
      await teamPermission(tx, actor, teamId, true)
      await tx`UPDATE invitations SET revoked_at=now() WHERE id=${invitationId} AND team_id=${teamId}`
      await audit(tx, actor, null, 'team.invitation_revoked', context.get('requestId'), { teamId, invitationId })
    })
    return context.body(null, 204)
  })
  return routes
}
