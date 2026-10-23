import { Hono } from 'hono'
import { z } from 'zod'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import type { Config } from '../../config/env'
import type { Database } from '../../db/connection'
import type { ApiEnv } from '../../middleware/types'
import type { RateLimiter } from '../../security/rate-limit'
import { body, param } from '../../contracts/http'
import { name } from '../../contracts/primitives'
import { ApiError } from '../../security/errors'
import { digest, newId, token } from '../../security/tokens'
import { audit } from '../audit/service'
import { authenticate, createSession, verifyCsrf, extendSession } from './session'
import { checkLogin, failedLogin, successfulLogin } from '../../security/login-throttle'

export const credentials = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((value) => value.toLowerCase()),
    password: z.string().min(12).max(256),
  })
  .strict()
export const registration = credentials.extend({ name })
export function authRoutes(db: Database, config: Config, limits: RateLimiter) {
  const routes = new Hono<ApiEnv>()
  const cookieOptions = {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'Lax' as const,
    path: '/',
    maxAge: config.SESSION_ABSOLUTE_SECONDS,
  }
  const dummy = Bun.password.hash('nonexistent-account-constant-password', { algorithm: 'argon2id' })
  routes.post('/register', async (context) => {
    if (
      config.PUBLIC_REGISTRATION === 'false' ||
      (config.NODE_ENV === 'production' && config.PUBLIC_REGISTRATION !== 'true')
    ) {
      throw new ApiError(
        403,
        'REGISTRATION_DISABLED',
        'Public registration is not enabled on this deployment',
      )
    }
    const input = await body(context, registration)
    await limits.consume(`register:${digest(input.email)}`, 4, 3600)
    const passwordHash = await Bun.password.hash(input.password, { algorithm: 'argon2id' })
    const userId = newId('user')
    const result = await db.begin(async (tx) => {
      const [user] =
        await tx`INSERT INTO users(id,email,name,password_hash) VALUES (${userId},${input.email},${input.name},${passwordHash})
        ON CONFLICT(email) DO NOTHING RETURNING id,email,name`
      if (!user) throw new ApiError(409, 'REGISTRATION_FAILED', 'Unable to register with those details')
      const session = await createSession(
        tx,
        user.id,
        config,
        context.req.header('User-Agent') || 'Unknown device',
      )
      await audit(
        tx,
        { ...user, sessionId: session.sessionId },
        null,
        'auth.register',
        context.get('requestId'),
      )
      return { user, session }
    })
    setCookie(context, config.COOKIE_NAME, result.session.raw, cookieOptions)
    return context.json({ user: result.user, csrfToken: result.session.csrf }, 201)
  })
  routes.post('/login', async (context) => {
    const input = await body(context, credentials)
    await limits.consume(`login:${digest(input.email)}`, 8, 900)
    await checkLogin(db, input.email)
    const [user] = await db`SELECT id,email,name,password_hash FROM users WHERE email=${input.email}`
    const valid = await Bun.password.verify(input.password, user?.password_hash || (await dummy))
    if (!user || !valid) {
      await failedLogin(db, input.email)
      await audit(db, null, null, 'auth.login_failed', context.get('requestId'))
      throw new ApiError(401, 'LOGIN_FAILED', 'Email or password is incorrect')
    }
    await successfulLogin(db, input.email)
    const result = await db.begin(async (tx) => {
      const session = await createSession(
        tx,
        user.id,
        config,
        context.req.header('User-Agent') || 'Unknown device',
      )
      const previous = getCookie(context, config.COOKIE_NAME)
      if (previous)
        await tx`UPDATE sessions SET revoked_at=now() WHERE token_hash=${digest(previous)} AND user_id=${user.id}`
      await audit(tx, { ...user, sessionId: session.sessionId }, null, 'auth.login', context.get('requestId'))
      return session
    })
    setCookie(context, config.COOKIE_NAME, result.raw, cookieOptions)
    return context.json({ user: { id: user.id, email: user.email, name: user.name }, csrfToken: result.csrf })
  })
  routes.get('/session', async (context) => {
    const actor = await authenticate(db, getCookie(context, config.COOKIE_NAME))
    await extendSession(db, actor, config)
    const csrfToken = token()
    await db`UPDATE sessions SET csrf_hash=${digest(csrfToken)} WHERE id=${actor.sessionId}`
    return context.json({ user: { id: actor.id, email: actor.email, name: actor.name }, csrfToken })
  })
  routes.post('/logout', async (context) => {
    const actor = await authenticate(db, getCookie(context, config.COOKIE_NAME))
    await verifyCsrf(db, actor, context.req.header('X-CSRF-Token'))
    await db.begin(async (tx) => {
      await tx`UPDATE sessions SET revoked_at=now() WHERE id=${actor.sessionId}`
      await audit(tx, actor, null, 'auth.logout', context.get('requestId'))
    })
    deleteCookie(context, config.COOKIE_NAME, cookieOptions)
    return context.body(null, 204)
  })
  routes.post('/logout-all', async (context) => {
    const actor = await authenticate(db, getCookie(context, config.COOKIE_NAME))
    await verifyCsrf(db, actor, context.req.header('X-CSRF-Token'))
    await db.begin(async (tx) => {
      await tx`UPDATE sessions SET revoked_at=now() WHERE user_id=${actor.id}`
      await audit(tx, actor, null, 'auth.logout_all', context.get('requestId'))
    })
    deleteCookie(context, config.COOKIE_NAME, cookieOptions)
    return context.body(null, 204)
  })
  routes.get('/sessions', async (context) => {
    const actor = await authenticate(db, getCookie(context, config.COOKIE_NAME))
    return context.json(
      await db`SELECT id,device,created_at,last_seen_at,expires_at FROM sessions
      WHERE user_id=${actor.id} AND revoked_at IS NULL AND expires_at>now() AND idle_expires_at>now() ORDER BY created_at DESC LIMIT 100`,
    )
  })
  routes.delete('/sessions/:sessionId', async (context) => {
    const actor = await authenticate(db, getCookie(context, config.COOKIE_NAME))
    await verifyCsrf(db, actor, context.req.header('X-CSRF-Token'))
    const sessionId = param(context, 'sessionId')
    await db`UPDATE sessions SET revoked_at=now() WHERE user_id=${actor.id} AND id=${sessionId}`
    return context.body(null, 204)
  })
  return routes
}
