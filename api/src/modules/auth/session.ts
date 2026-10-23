import type { Database } from '../../db/connection'
import type { Config } from '../../config/env'
import { digest, newId, token } from '../../security/tokens'
import { ApiError } from '../../security/errors'

export type Actor = { id: string; email: string; name: string; sessionId: string }
export async function authenticate(db: Database, raw: string | undefined): Promise<Actor> {
  if (!raw || raw.length !== 43) throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in to continue')
  const [row] = await db`UPDATE sessions s SET last_seen_at=now()
    FROM users u WHERE s.user_id=u.id AND s.token_hash=${digest(raw)} AND s.revoked_at IS NULL
    AND s.expires_at>now() AND s.idle_expires_at>now()
    RETURNING u.id,u.email,u.name,s.id AS session_id`
  if (!row) throw new ApiError(401, 'UNAUTHENTICATED', 'Session expired or revoked')
  return { id: row.id, email: row.email, name: row.name, sessionId: row.session_id }
}
export async function extendSession(db: Database, actor: Actor, config: Config) {
  await db`UPDATE sessions SET idle_expires_at=LEAST(expires_at,now()+${config.SESSION_IDLE_SECONDS}*interval '1 second')
    WHERE id=${actor.sessionId} AND revoked_at IS NULL`
}
export async function createSession(db: Database, userId: string, config: Config, device: string) {
  const raw = token(),
    csrf = token(),
    sessionId = newId('session')
  await db`INSERT INTO sessions(id,user_id,token_hash,csrf_hash,expires_at,idle_expires_at,device)
    VALUES (${sessionId},${userId},${digest(raw)},${digest(csrf)},
      now()+${config.SESSION_ABSOLUTE_SECONDS}*interval '1 second',
      now()+${config.SESSION_IDLE_SECONDS}*interval '1 second',${device.slice(0, 200)})`
  return { raw, csrf, sessionId }
}
export async function verifyCsrf(db: Database, actor: Actor, csrf: string | undefined) {
  if (!csrf || csrf.length !== 43)
    throw new ApiError(403, 'CSRF_FAILED', 'Refresh your session before making changes')
  const [row] =
    await db`SELECT 1 FROM sessions WHERE id=${actor.sessionId} AND csrf_hash=${digest(csrf)} AND revoked_at IS NULL`
  if (!row) throw new ApiError(403, 'CSRF_FAILED', 'Refresh your session before making changes')
}
