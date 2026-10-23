import type { MiddlewareHandler } from 'hono'
import type { ApiEnv } from './types'
import { log } from '../security/log'
import { report, type TelemetrySink } from './telemetry'
export class Metrics {
  constructor(readonly sink?: TelemetrySink) {}
  requests = 0
  errors = 0
  latencyMs = 0
  connections = 0
  jobsCompleted = 0
  jobsFailed = 0
  snapshot() {
    return {
      requests: this.requests,
      errors: this.errors,
      latencyMs: this.latencyMs,
      connections: this.connections,
      jobsCompleted: this.jobsCompleted,
      jobsFailed: this.jobsFailed,
    }
  }
}
export function observe(metrics: Metrics): MiddlewareHandler<ApiEnv> {
  return async (context, next) => {
    const requestId = crypto.randomUUID(),
      started = performance.now()
    context.set('requestId', requestId)
    if (context.req.header('Upgrade')?.toLowerCase() !== 'websocket') {
      context.header('X-Request-Id', requestId)
      context.header('Cache-Control', 'private, no-store')
    }
    await next()
    const elapsed = Math.round(performance.now() - started)
    metrics.requests++
    metrics.latencyMs += elapsed
    if (context.res.status >= 400) metrics.errors++
    report(metrics.sink, 'request', {
      method: context.req.method,
      status: context.res.status,
      elapsedMs: elapsed,
    })
    log('http.request', {
      requestId,
      method: context.req.method,
      status: context.res.status,
      elapsedMs: elapsed,
    })
  }
}
