import { expect, test } from 'bun:test'
import { Hono } from 'hono'
import { memberTraffic, traffic } from '../src/middleware/traffic'
import { ApiError } from '../src/security/errors'
import { digest } from '../src/security/tokens'
import type { RateLimiter } from '../src/security/rate-limit'
import type { ApiEnv } from '../src/middleware/types'
import { testClientAddress } from './helpers'

type Consumption = { key: string; maximum: number; seconds: number }

/** Records what the limiter was asked to do so the middleware contract is visible without a database. */
function recorder(throwAfter?: number) {
  const seen: Consumption[] = []
  const limits = {
    async consume(key: string, maximum: number, seconds: number) {
      seen.push({ key, maximum, seconds })
      if (throwAfter !== undefined && seen.length > throwAfter)
        throw new ApiError(503, 'RATE_LIMIT_UNAVAILABLE', 'Request protection is temporarily unavailable')
    },
  } as unknown as RateLimiter
  return { limits, seen }
}

function application(middleware: ReturnType<typeof traffic>, address?: string) {
  const app = new Hono<ApiEnv>()
  app.use(middleware)
  app.get('/api/v1/auth/login', (context) => context.text('handler', 200))
  app.get('/api/v1/projects', (context) => context.text('handler', 200))
  app.options('/api/v1/projects', (context) => context.body(null, 204))
  return (path: string, init?: RequestInit) =>
    app.request(
      path,
      init,
      address === undefined ? undefined : { server: { requestIP: () => ({ address }) } },
    )
}

test('each peer gets its own budget instead of one shared fallback bucket', async () => {
  const { limits, seen } = recorder()
  const call = application(traffic(limits, ''))
  await call('/api/v1/projects')
  await call('/api/v1/projects')
  expect(seen.map((item) => item.key)).toEqual([
    `ip:normal:${digest('in-process')}`,
    `ip:normal:${digest('in-process')}`,
  ])
  const first = application(traffic(limits, ''), '192.0.2.1'),
    second = application(traffic(limits, ''), '198.51.100.2')
  await first('/api/v1/projects')
  await second('/api/v1/projects')
  expect(seen.slice(2).map((item) => item.key)).toEqual([
    `ip:normal:${digest('192.0.2.1')}`,
    `ip:normal:${digest('198.51.100.2')}`,
  ])
})

test('auth traffic is tighter than ordinary traffic and preflight is free', async () => {
  const { limits, seen } = recorder()
  const call = application(traffic(limits, ''), '203.0.113.7')
  await call('/api/v1/auth/login')
  await call('/api/v1/projects')
  const preflight = await call('/api/v1/projects', { method: 'OPTIONS' })
  expect(seen[0]).toMatchObject({ key: `ip:auth:${digest('203.0.113.7')}`, maximum: 50, seconds: 60 })
  expect(seen[1].key).toBe(`ip:normal:${digest('203.0.113.7')}`)
  expect(seen[1].maximum).toBe(1000)
  expect(seen).toHaveLength(2)
  expect(preflight.status).toBe(204)
})

test('X-Real-IP is believed only when the peer is a configured proxy', async () => {
  const { limits, seen } = recorder()
  const spoofed = application(traffic(limits, '198.51.100.9'), '203.0.113.66')
  await spoofed('/api/v1/projects', { headers: { 'X-Real-IP': '203.0.113.1' } })
  expect(seen[0].key).toBe(`ip:normal:${digest('203.0.113.66')}`)
  const behind = application(traffic(limits, '198.51.100.9, 203.0.113.66'), '203.0.113.66')
  await behind('/api/v1/projects', { headers: { 'X-Real-IP': '192.0.2.44' } })
  expect(seen[1].key).toBe(`ip:normal:${digest('192.0.2.44')}`)
  const malformed = application(traffic(limits, '203.0.113.66'), '203.0.113.66')
  await malformed('/api/v1/projects', { headers: { 'X-Real-IP': 'not-an-ip' } })
  expect(seen[2].key).toBe(`ip:normal:${digest('203.0.113.66')}`)
})

test('protection that cannot decide fails closed before the handler runs', async () => {
  const { limits } = recorder(0)
  const reached: string[] = []
  const app = new Hono<ApiEnv>()
  app.use(traffic(limits, ''))
  app.get('/api/v1/projects', (context) => {
    reached.push('handler')
    return context.text('handler', 200)
  })
  app.onError((error, context) => context.text('refused', error instanceof ApiError ? error.status : 500))
  const response = await app.request('/api/v1/projects')
  expect(response.status).toBe(503)
  expect(reached).toEqual([])
})

test('member traffic separates provider work, uploads and ordinary reads', async () => {
  const { limits, seen } = recorder()
  const authorised = new Hono<ApiEnv>()
  authorised.use(async (context, next) => {
    context.set('actor', { id: 'user_1' } as never)
    await next()
  })
  authorised.use(memberTraffic(limits))
  authorised.get('/api/v1/projects', (context) => context.text('handler', 200))
  authorised.post('/api/v1/projects/p_1/analysis', (context) => context.text('handler', 200))
  authorised.post('/api/v1/projects/p_1/assets/uploads', (context) => context.text('handler', 200))
  authorised.post('/api/v1/projects/p_1/assets/optimized-upload', (context) => context.text('handler', 200))
  await authorised.request('/api/v1/projects')
  await authorised.request('/api/v1/projects/p_1/analysis', { method: 'POST' })
  await authorised.request('/api/v1/projects/p_1/assets/uploads', { method: 'POST' })
  await authorised.request('/api/v1/projects/p_1/assets/optimized-upload', { method: 'POST' })
  expect(seen).toEqual([
    { key: 'user:normal:user_1', maximum: 600, seconds: 60 },
    { key: 'user:ai:user_1', maximum: 15, seconds: 60 },
    { key: 'user:upload:user_1', maximum: 30, seconds: 60 },
    { key: 'user:upload:user_1', maximum: 30, seconds: 60 },
  ])
})

test('the test harness gives every suite its own peer address', () => {
  // Three RFC 5737 documentation blocks of 254 hosts; no suite can collide with a real client,
  // and none of these can ever match TRUSTED_PROXY_IPS, which is what keeps X-Real-IP honest.
  const addresses = Array.from({ length: 700 }, testClientAddress)
  expect(new Set(addresses).size).toBe(700)
  expect(addresses.every((address) => /^(192\.0\.2|198\.51\.100|203\.0\.113)\.\d{1,3}$/.test(address))).toBe(
    true,
  )
  expect(addresses).not.toContain('in-process')
})
