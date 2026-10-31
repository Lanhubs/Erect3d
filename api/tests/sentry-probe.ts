import { Hono } from 'hono'
import { createApp } from '../src/app'
import { createServices } from '../src/config/services'
import type { Database } from '../src/db/connection'
import { readConfig } from '../src/config/env'
import { ApiError } from '../src/security/errors'
import { ProviderFailure } from '../src/modules/ai/provider'
import { Metrics, observe } from '../src/middleware/observability'
import type { ApiEnv } from '../src/middleware/types'
import {
  captureIncident,
  closeIncidentReporting,
  mountIncidentReporting,
  startIncidentReporting,
} from '../src/monitoring'

/**
 * Runs the real reporting path against a loopback ingest endpoint: the SDK's own transport
 * serializes and POSTs genuine envelopes, so nothing here is a mocked capture. Import this file as a
 * script (the suite spawns it) because initialising Sentry installs process-wide handlers.
 */
const envelopes: string[] = []
const ingest = Bun.serve({
  hostname: '127.0.0.1',
  port: 0,
  async fetch(request) {
    envelopes.push(await request.text())
    return new Response('{"id":"probe-event"}', { headers: { 'content-type': 'application/json' } })
  },
})

/** Every value is a production-shaped placeholder: the DSN destination is the only real setting. */
const config = readConfig({
  NODE_ENV: 'production',
  DATABASE_URL: 'postgres://erect:erect@127.0.0.1:55432/erect_probe_test',
  DATABASE_TLS: 'verify-full',
  ALLOWED_ORIGINS: 'https://erect.example.test',
  STORAGE_BACKEND: 'filesystem',
  STORAGE_ROOT: '/tmp/erect-probe-storage',
  STORAGE_SIGNING_KEY: 'probe-signing-key-0000000000000000',
  SENTRY_DSN: 'https://probekey@o1.ingest.sentry.io/4501',
  SENTRY_RELEASE: 'erect3d-api@probe',
})
// Only the destination is replaced, so every other production option stays in force.
const started = startIncidentReporting(config, { dsn: `http://probekey@127.0.0.1:${ingest.port}/4501` })

function application(reporting: boolean) {
  const app = new Hono<ApiEnv>()
  app.use('*', observe(new Metrics()))
  if (reporting) mountIncidentReporting(app)
  app.get('/ok', (context) => context.json({ status: 'alive' }))
  app.get('/missing', (context) => context.json({ error: { code: 'NOT_FOUND' } }, 404))
  app.get('/invalid', () => {
    throw new ApiError(400, 'VALIDATION', 'Body rejected')
  })
  app.get('/duplicate', () => {
    throw Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' })
  })
  app.get('/boom', () => {
    throw new TypeError('connection refused at postgres://erect:private-password@db.internal:5432/erect_prod')
  })
  // The client-visible contract is app.onError's, whichever paths report.
  app.onError((error, context) => {
    const known = error instanceof ApiError
    return context.json(
      {
        error: {
          code: known ? error.code : 'INTERNAL_ERROR',
          message: known ? error.message : 'An unexpected error occurred',
          requestId: context.get('requestId'),
        },
      },
      known ? error.status : 500,
    )
  })
  return app
}

const paths = ['/ok', '/missing', '/invalid', '/duplicate', '/boom']
async function drive(reporting: boolean) {
  const app = application(reporting),
    observed: Record<string, unknown> = {}
  for (const path of paths) {
    const response = await app.request(path, { headers: { cookie: 'erect_session=probe-session-value' } })
    const body = (await response.json()) as { error?: Record<string, unknown> }
    // The request id differs on every run; the header check below proves it is still delivered.
    if (body.error) delete body.error.requestId
    observed[path] = {
      status: response.status,
      body,
      requestId: response.headers.get('X-Request-Id') !== null,
    }
  }
  return observed
}

const withoutReporting = await drive(false)
const withReporting = await drive(true)
// The real application, not a miniature: reporting is mounted before its routes and the liveness
// route still answers. Readiness needs a database, so only its status code is recorded.
const real = createApp(createServices(config, { db: {} as Database }))
const routing = {
  health: await (await real.request('/health')).json(),
  ready: (await real.request('/ready')).status,
  openapi: (await real.request('/api/v1/openapi.json')).status,
  routes: real.routes.length,
}
// The worker path: a job failure reports only when the same policy says it is an incident.
captureIncident(new ProviderFailure('AI_UPSTREAM', true, 503), {
  jobId: 'probe-job',
  requestId: 'probe-request',
  kind: 'analysis',
  code: 'AI_UPSTREAM',
})
for (const quiet of [
  new ApiError(503, 'AI_UNAVAILABLE', 'Cloud interpretation has not been configured'),
  new ProviderFailure('AI_QUOTA', true),
  Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' }),
])
  captureIncident(quiet, { jobId: 'probe-quiet', kind: 'analysis' })
await closeIncidentReporting(5000)
ingest.stop()

console.log(
  JSON.stringify({
    started,
    withoutReporting,
    withReporting,
    routing,
    incidentCount: envelopes.filter((body) => body.includes('exception')).length,
    envelopes,
  }),
)
