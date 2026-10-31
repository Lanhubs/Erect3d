import { afterAll, expect, test } from 'bun:test'
import { Hono } from 'hono'
import { Metrics, observe } from '../src/middleware/observability'
import { configureLogging, log } from '../src/logging'
import type { ApiEnv } from '../src/middleware/types'

/**
 * The module logger is process-wide, so the capture is installed here and always handed back
 * to the default writer; a leaked sink would silence every later file in the same process.
 */
const lines: string[] = []
configureLogging('info', (line) => lines.push(line))
afterAll(() => configureLogging('info'))

function application(metrics = new Metrics()) {
  const app = new Hono<ApiEnv>()
  app.use(observe(metrics))
  app.get('/ping', (context) => context.json({ requestId: context.get('requestId') }))
  app.get('/missing', (context) => context.text('nothing here', 404))
  app.get('/boom', () => {
    throw new Error('postgres://user:private-password@localhost/db')
  })
  return app
}

const emitted = (event: string) => lines.map((line) => JSON.parse(line)).filter((row) => row.event === event)

test('a request logs one structured line whose id is the response header and the handler id', async () => {
  const metrics = new Metrics(),
    before = emitted('http.request').length,
    response = await application(metrics).request('/ping'),
    handler = (await response.json()).requestId as string,
    row = emitted('http.request').at(-1)
  expect(emitted('http.request')).toHaveLength(before + 1)
  expect(row).toMatchObject({ event: 'http.request', level: 'info', method: 'GET', status: 200 })
  expect(row.requestId).toBeString()
  expect(typeof row.elapsedMs).toBe('number')
  expect(response.headers.get('X-Request-Id')).toBe(row.requestId)
  expect(handler).toBe(row.requestId)
  // Shared caches must never serve one tenant's response to another request id.
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  expect(metrics.snapshot()).toMatchObject({ requests: 1, errors: 0 })
  expect(metrics.snapshot().latencyMs).toBeGreaterThanOrEqual(0)
})

test('a rejected request raises the level and counts an error without logging a body', async () => {
  const metrics = new Metrics()
  const response = await application(metrics).request('/missing')
  const row = emitted('http.request').at(-1)
  expect(response.status).toBe(404)
  expect(row).toMatchObject({ status: 404, level: 'warn' })
  expect(metrics.snapshot()).toMatchObject({ requests: 1, errors: 1 })
})

test('an unhandled failure is classified and its message cannot reach the log', async () => {
  const metrics = new Metrics()
  const app = application(metrics)
  app.onError((error, context) => {
    log('http.error', { requestId: context.get('requestId'), error })
    return context.text('failed', 500)
  })
  const response = await app.request('/boom')
  const row = emitted('http.error').at(-1)
  expect(response.status).toBe(500)
  expect(row.error).toEqual({ name: 'Error', code: 'UNEXPECTED_ERROR' })
  expect(JSON.stringify(row)).not.toContain('private-password')
  expect(metrics.snapshot()).toMatchObject({ requests: 1, errors: 1 })
})

test('a websocket upgrade keeps its id but never advertises a cached response', async () => {
  const response = await application().request('/ping', {
    headers: { Upgrade: 'websocket' },
  })
  expect(response.headers.get('X-Request-Id')).toBeNull()
  expect(response.headers.get('Cache-Control')).toBeNull()
})
