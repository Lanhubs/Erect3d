import type { MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import type { Config } from '../config/env'
import type { Database } from '../db/connection'
import { authenticate, extendSession, verifyCsrf } from '../modules/auth/session'
import { ApiError } from '../security/errors'
import type { ApiEnv } from './types'

export function originGuard(config: Config): MiddlewareHandler<ApiEnv> {
  const allowed = new Set(config.ALLOWED_ORIGINS.split(',').map(item => item.trim()))
  return async (context, next) => {
    const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(context.req.method)
    const origin = context.req.header('Origin')
    if (mutating && (!origin || !allowed.has(origin))) throw new ApiError(403, 'ORIGIN_DENIED', 'A trusted Origin header is required')
    if (context.req.header('Sec-Fetch-Site') === 'cross-site' && (!origin || !allowed.has(origin))) {
      throw new ApiError(403, 'ORIGIN_DENIED', 'Cross-site request rejected')
    }
    await next()
  }
}
export function sessionGuard(db: Database, config: Config): MiddlewareHandler<ApiEnv> {
  return async (context, next) => {
    const actor = await authenticate(db, getCookie(context, config.COOKIE_NAME))
    context.set('actor', actor)
    await extendSession(db, actor, config)
    if (!['GET', 'HEAD', 'OPTIONS'].includes(context.req.method)) await verifyCsrf(db, actor, context.req.header('X-CSRF-Token'))
    await next()
  }
}
