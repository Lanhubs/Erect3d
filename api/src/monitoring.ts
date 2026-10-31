import { captureException, flush, init, isEnabled, withScope } from '@sentry/bun'
import type { BunOptions, ErrorEvent } from '@sentry/bun'
import { honoMiddleware } from '@sentry/hono/bun'
import type { MiddlewareHandler } from 'hono'
import type { Hono } from 'hono'
import type { ApiEnv } from './middleware/types'
import type { Config } from './config/env'
import { ApiError } from './security/errors'
import { ProviderFailure } from './modules/ai/provider'
import { scrubText } from './logging'

/**
 * An upstream outage is an incident. Quota, refusals, timeouts and schema rejections are expected
 * provider behaviour that the job retry policy, metrics and the structured log already record.
 */
const providerIncidents = new Set(['AI_UPSTREAM', 'AI_NETWORK'])

/** The single policy every reporting path uses, so one failure is never counted twice or filed twice. */
export function incidentWorthy(error: unknown): boolean {
  if (error instanceof ApiError) return false
  if (error instanceof ProviderFailure) return providerIncidents.has(error.code)
  if (!error || typeof error !== 'object') return true
  const failure = error as { code?: unknown; status?: unknown }
  if (String(failure.code) === '23505') return false
  const status = Number(failure.status)
  return !(status >= 300 && status < 500)
}

/** Runs the logger's credential rules over every string in a JSON subtree. */
function scrubStrings(value: unknown): unknown {
  if (typeof value === 'string') return scrubText(value)
  if (Array.isArray(value)) return value.map(scrubStrings)
  if (value && typeof value === 'object')
    for (const [key, item] of Object.entries(value))
      (value as Record<string, unknown>)[key] = scrubStrings(item)
  return value
}

/**
 * An incident is a report about the server, not a copy of the request. Sessions, headers and bodies
 * stay local, and the same credential scrub the logger applies runs over the exception text, because
 * a thrown driver or provider error can carry a connection string in its message.
 */
export function scrubIncident(event: ErrorEvent): ErrorEvent {
  const request = event.request as Record<string, unknown> | undefined
  if (request) for (const field of ['cookies', 'headers', 'data', 'env']) delete request[field]
  if (typeof event.message === 'string') event.message = scrubText(event.message)
  // Every string under `exception`, not only `value`: the stack frames carry the source lines around
  // the throw, so a literal credential that appears in the code would otherwise leave in the report.
  if (event.exception)
    event.exception.values = scrubStrings(event.exception.values) as typeof event.exception.values
  if (event.extra) event.extra = scrubStrings(event.extra) as Record<string, unknown>
  return event
}

export function incidentOptions(config: Config): BunOptions | undefined {
  if (!config.SENTRY_DSN) return undefined
  return {
    dsn: config.SENTRY_DSN,
    environment: config.NODE_ENV,
    release: config.SENTRY_RELEASE,
    // Request volume and latency belong to the repository's own metrics endpoint, so Sentry
    // carries incidents only.
    tracesSampleRate: 0,
    // Sentry 11 collects cookies, headers, bodies, query strings, locals and source lines by default,
    // so each field that could carry session or repository material is switched off explicitly.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      stackFrameVariables: false,
      frameContextLines: 0,
    },
    beforeSend: scrubIncident,
  }
}

/** Reporting stays completely inert while `SENTRY_DSN` is empty: no client, no patches, no network. */
export function startIncidentReporting(config: Config, overrides: Partial<BunOptions> = {}): boolean {
  const options = incidentOptions(config)
  if (!options) return false
  init({ ...options, ...overrides })
  return isEnabled()
}

export function mountIncidentReporting(app: Hono<ApiEnv>): void {
  if (!isEnabled()) return
  // The middleware reads the error Hono recorded on the context after the response was built, so
  // `app.onError` keeps owning the client-visible error contract.
  const middleware = honoMiddleware(app, { shouldHandleError: incidentWorthy }) as MiddlewareHandler<ApiEnv>
  app.use('*', middleware)
}

export function captureIncident(error: unknown, context: Record<string, string | number | undefined>): void {
  if (!isEnabled() || !incidentWorthy(error)) return
  try {
    // A forked scope keeps job identifiers on this incident alone instead of tagging every later event.
    withScope((scope) => {
      scope.setContext('erect3d', { ...context })
      captureException(error, { mechanism: { handled: true, type: 'erect3d' } })
    })
  } catch {
    /* Reporting must not interrupt a job lease or a committed transaction. */
  }
}

export async function closeIncidentReporting(timeoutMs = 2000): Promise<void> {
  if (!isEnabled()) return
  try {
    await flush(timeoutMs)
  } catch {
    /* A shutdown path cannot wait on an unreachable collector. */
  }
}
