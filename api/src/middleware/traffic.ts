import type { MiddlewareHandler } from 'hono'
import type { ApiEnv } from './types'
import type { RateLimiter } from '../security/rate-limit'
import { digest } from '../security/tokens'
import { isIP } from 'node:net'
export function traffic(limits: RateLimiter, trustedProxyIps: string): MiddlewareHandler<ApiEnv> {
  return async (context, next) => {
    if (context.req.method === 'OPTIONS') return next()
    const runtime = context.env as
      { server?: { requestIP(request: Request): { address: string } | null } } | undefined
    const peer = runtime?.server?.requestIP(context.req.raw)?.address || 'in-process'
    const forwarded = context.req.header('X-Real-IP')
    const ip =
      forwarded &&
      isIP(forwarded) &&
      trustedProxyIps
        .split(',')
        .map((value) => value.trim())
        .includes(peer)
        ? forwarded
        : peer
    const category = context.req.path.startsWith('/api/v1/auth') ? 'auth' : 'normal'
    await limits.consume(`ip:${category}:${digest(ip)}`, category === 'auth' ? 50 : 1000, 60)
    await next()
  }
}
export function memberTraffic(limits: RateLimiter): MiddlewareHandler<ApiEnv> {
  return async (context, next) => {
    const path = context.req.path,
      userId = context.get('actor').id
    // Polling and reviewing proposals do not call the provider or spend its request quota.
    const startsAnalysis =
      context.req.method === 'POST' && /^\/api\/v1\/projects\/[^/]+\/analysis$/.test(path)
    const startsUpload = context.req.method === 'POST' && /\/assets\/(uploads|optimized-upload)$/.test(path)
    const kind = startsAnalysis ? 'ai' : startsUpload ? 'upload' : 'normal'
    await limits.consume(`user:${kind}:${userId}`, kind === 'ai' ? 15 : kind === 'upload' ? 30 : 600, 60)
    await next()
  }
}
