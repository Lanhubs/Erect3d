import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { bodyLimit } from 'hono/body-limit'
import { compress } from 'hono/compress'
import { every } from 'hono/combine'
import type { Services } from './config/services'
import type { ApiEnv } from './middleware/types'
import { observe } from './middleware/observability'
import { originGuard } from './middleware/auth'
import { traffic } from './middleware/traffic'
import { ApiError } from './security/errors'
import { log } from './security/log'
import { report } from './middleware/telemetry'
import { mountRoutes } from './routes'
import { buildOpenApi } from './contracts/openapi'
import { mountPrivateObjects } from './storage/routes'
export function createApp(services: Services) {
  const app = new Hono<ApiEnv>({ strict: false }),
    { config, db, metrics, limits, store } = services
  app.use('*', observe(metrics))
  const security = secureHeaders({
    xFrameOptions: 'DENY',
    referrerPolicy: 'no-referrer',
    strictTransportSecurity: config.NODE_ENV === 'production' ? 'max-age=31536000; includeSubDomains' : false,
  })
  const crossOrigin = cors({
    origin: config.ALLOWED_ORIGINS.split(',').map((value) => value.trim()),
    credentials: true,
    allowHeaders: ['Content-Type', 'X-CSRF-Token', 'Idempotency-Key', 'If-None-Match'],
    exposeHeaders: ['X-Request-Id', 'ETag'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
  const compression = compress({ threshold: 4096, contentTypeFilter: /^application\/json/ })
  const browserHeaders = every(security, crossOrigin, compression)
  app.use('*', async (context, next) => {
    if (context.req.header('Upgrade')?.toLowerCase() === 'websocket') return next()
    await browserHeaders(context, next)
  })
  app.use('/api/v1/*', originGuard(config))
  app.use('/api/v1/*', async (context, next) => {
    const upload =
      context.req.method === 'POST' &&
      /^\/api\/v1\/projects\/[a-zA-Z0-9_.:-]+\/assets\/optimized-upload\/?$/.test(context.req.path)
    if (upload) return next()
    return bodyLimit({
      maxSize: 2 * 1024 * 1024,
      onError: (context) =>
        context.json(
          {
            error: {
              code: 'BODY_TOO_LARGE',
              message: 'Request exceeds its permitted size',
              requestId: context.get('requestId'),
            },
          },
          413,
        ),
    })(context, next)
  })
  app.use('/api/v1/*', traffic(limits, config.TRUSTED_PROXY_IPS))
  app.get('/health', (context) => context.json({ status: 'alive' }))
  app.get('/ready', async (context) => {
    try {
      await services.readiness.check()
      return context.json({
        status: 'ready',
        capabilities: {
          privateAssets: !!store,
          cloudAnalysis: !!services.provider,
          assistant: !!services.editingProvider,
          realtime: true,
        },
      })
    } catch {
      return context.json({ status: 'unavailable' }, 503)
    }
  })
  mountRoutes(app, services)
  app.use('/private-assets/*', traffic(limits, config.TRUSTED_PROXY_IPS))
  mountPrivateObjects(app, services)
  app.get('/api/v1/openapi.json', (context) => context.json(buildOpenApi(app, config.COOKIE_NAME)))
  app.onError((error, context) => {
    const requestId = context.get('requestId'),
      known = error instanceof ApiError
    const duplicate = 'code' in error && error.code === '23505'
    const status = known ? error.status : duplicate ? 409 : 500
    log('http.error', { requestId, code: known ? error.code : duplicate ? 'CONFLICT' : 'INTERNAL_ERROR' })
    report(metrics.sink, 'error', {
      requestId,
      code: known ? error.code : duplicate ? 'CONFLICT' : 'INTERNAL_ERROR',
      status,
    })
    return context.json(
      {
        error: {
          code: known ? error.code : duplicate ? 'CONFLICT' : 'INTERNAL_ERROR',
          message: known
            ? error.message
            : duplicate
              ? 'Resource already exists'
              : 'An unexpected error occurred',
          requestId,
          ...(known && error.details ? { details: error.details } : {}),
        },
      },
      status,
    )
  })
  app.notFound((context) =>
    context.json(
      { error: { code: 'NOT_FOUND', message: 'Route not found', requestId: context.get('requestId') } },
      404,
    ),
  )
  return app
}
