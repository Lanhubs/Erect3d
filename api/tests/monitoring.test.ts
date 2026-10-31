import { expect, test } from 'bun:test'
import { Hono } from 'hono'
import { ApiError } from '../src/security/errors'
import { ProviderFailure } from '../src/modules/ai/provider'
import { readConfig } from '../src/config/env'
import type { ApiEnv } from '../src/middleware/types'
import {
  incidentOptions,
  incidentWorthy,
  mountIncidentReporting,
  startIncidentReporting,
} from '../src/monitoring'

const base = { NODE_ENV: 'test', DATABASE_URL: 'postgres://erect:erect@127.0.0.1:55432/erect_config_test' }

test('incident reporting stays unconfigured when no DSN is supplied', () => {
  const config = readConfig(base)
  expect(incidentOptions(config)).toBeUndefined()
  expect(startIncidentReporting(config)).toBe(false)
  // Nothing was initialised, so the application keeps the middleware stack it always had.
  const app = new Hono<ApiEnv>()
  app.get('/ping', (context) => context.json({ ok: true }))
  mountIncidentReporting(app)
  expect(app.routes.length).toBe(1)
})

test('a configured DSN identifies the environment and release without tracing or collected data', () => {
  const config = readConfig({
    ...base,
    SENTRY_DSN: 'https://publickey@o1.ingest.sentry.io/4501234567890123',
    SENTRY_RELEASE: 'erect3d-api@0.1.0',
  })
  expect(incidentOptions(config)).toMatchObject({
    dsn: 'https://publickey@o1.ingest.sentry.io/4501234567890123',
    environment: 'test',
    release: 'erect3d-api@0.1.0',
    tracesSampleRate: 0,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      stackFrameVariables: false,
      frameContextLines: 0,
    },
  })
})

test('a DSN is validated like every other endpoint: HTTPS, no secret, no query', () => {
  for (const dsn of [
    'http://key@o1.ingest.sentry.io/1',
    'https://key:secret@o1.ingest.sentry.io/1',
    'https://key@o1.ingest.sentry.io/1?token=abc',
    'https://key@o1.ingest.sentry.io/projects/1',
    'not-a-dsn',
  ])
    expect(() => readConfig({ ...base, SENTRY_DSN: dsn }), dsn).toThrow('SENTRY_DSN')
  expect(() => readConfig({ ...base, SENTRY_DSN: 'https://key@o1.ingest.sentry.io/1' })).not.toThrow()
  expect(readConfig({ ...base, SENTRY_DSN: '' }).SENTRY_DSN).toBeUndefined()
})

test('only unexpected failures qualify as incidents', () => {
  const unexpected = new TypeError('driver returned no rows')
  const unique = Object.assign(new Error('duplicate key'), { code: '23505' })
  const http = Object.assign(new Error('Not Found'), { status: 404 })
  const cases: [unknown, boolean][] = [
    [unexpected, true],
    [new Error('database connection lost'), true],
    [http, false],
    [new ApiError(400, 'VALIDATION', 'Body rejected'), false],
    [new ApiError(503, 'AI_UNAVAILABLE', 'Cloud interpretation has not been configured'), false],
    [unique, false],
    [new ProviderFailure('AI_UPSTREAM', true, 503), true],
    [new ProviderFailure('AI_NETWORK', true), true],
    [new ProviderFailure('AI_QUOTA', true), false],
    [new ProviderFailure('AI_SCHEMA_REJECTED', false, 400), false],
  ]
  for (const [error, expected] of cases) expect(incidentWorthy(error), String(error)).toBe(expected)
})
