import { isIP } from 'node:net'
import type { z } from 'zod'
import type { Config } from './env'

/** A Sentry DSN is `https://<public key>@<host>/<numeric project id>`, without a secret or query. */
export function isSentryDsn(value: string) {
  try {
    const endpoint = new URL(value)
    return (
      endpoint.protocol === 'https:' &&
      !!endpoint.username &&
      !endpoint.password &&
      !endpoint.search &&
      !endpoint.hash &&
      /^\/\d+\/?$/.test(endpoint.pathname)
    )
  } catch {
    return false
  }
}

export function validateConfiguration(
  env: Config,
  context: z.RefinementCtx & {
    addIssue: (issue: { code: 'custom'; path: string[]; message: string }) => void
  },
) {
  if (env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT) {
    try {
      const endpoint = new URL(env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT)
      if (
        !['http:', 'https:'].includes(endpoint.protocol) ||
        endpoint.username ||
        endpoint.password ||
        endpoint.search ||
        endpoint.hash
      )
        throw new Error()
    } catch {
      context.addIssue({
        code: 'custom',
        path: ['OTEL_EXPORTER_OTLP_LOGS_ENDPOINT'],
        message: 'Use an HTTP(S) OTLP logs endpoint without credentials or query parameters',
      })
    }
  }
  try {
    if (!['postgres:', 'postgresql:'].includes(new URL(env.DATABASE_URL).protocol)) throw new Error()
  } catch {
    context.addIssue({ code: 'custom', path: ['DATABASE_URL'], message: 'Use a PostgreSQL connection URL' })
  }
  if (env.REDIS_URL) {
    try {
      if (!['redis:', 'rediss:'].includes(new URL(env.REDIS_URL).protocol)) throw new Error()
    } catch {
      context.addIssue({ code: 'custom', path: ['REDIS_URL'], message: 'Use a Redis connection URL' })
    }
  }
  if (
    env.TRUSTED_PROXY_IPS.split(',')
      .filter(Boolean)
      .some((value) => !isIP(value.trim()))
  ) {
    context.addIssue({ code: 'custom', path: ['TRUSTED_PROXY_IPS'], message: 'Use exact proxy IP addresses' })
  }
  if (env.SENTRY_DSN && !isSentryDsn(env.SENTRY_DSN)) {
    context.addIssue({
      code: 'custom',
      path: ['SENTRY_DSN'],
      message: 'Use an HTTPS Sentry DSN without credentials, query parameters or a bucket path',
    })
  }
  if (env.R2_ENDPOINT) {
    try {
      const endpoint = new URL(env.R2_ENDPOINT)
      if (
        endpoint.protocol !== 'https:' ||
        !endpoint.hostname.endsWith('.r2.cloudflarestorage.com') ||
        !['', '/'].includes(endpoint.pathname) ||
        endpoint.search ||
        endpoint.hash ||
        endpoint.username ||
        endpoint.password
      )
        throw new Error()
    } catch {
      context.addIssue({
        code: 'custom',
        path: ['R2_ENDPOINT'],
        message: 'Use the private Cloudflare R2 HTTPS API endpoint, without bucket paths',
      })
    }
  }
  const origins = env.ALLOWED_ORIGINS.split(',').map((value) => value.trim())
  if (
    origins.some((value) => {
      try {
        return new URL(value).origin !== value
      } catch {
        return true
      }
    })
  ) {
    context.addIssue({
      code: 'custom',
      path: ['ALLOWED_ORIGINS'],
      message: 'Use exact origins, without paths or wildcards',
    })
  }
  if (env.NODE_ENV === 'production') {
    if (env.DATABASE_TLS !== 'verify-full')
      context.addIssue({
        code: 'custom',
        path: ['DATABASE_TLS'],
        message: 'Production requires verified database TLS',
      })
    if (origins.some((value) => !value.startsWith('https://')))
      context.addIssue({
        code: 'custom',
        path: ['ALLOWED_ORIGINS'],
        message: 'Production origins require HTTPS',
      })
    if (env.STORAGE_BACKEND === 'r2' && !env.R2_BUCKET)
      context.addIssue({
        code: 'custom',
        path: ['R2_BUCKET'],
        message: 'Production requires private R2 storage',
      })
  }
  if (env.RATE_LIMIT_BACKEND === 'redis' && !env.REDIS_URL) {
    context.addIssue({ code: 'custom', path: ['REDIS_URL'], message: 'Redis rate limits require REDIS_URL' })
  }
  const storage = [env.R2_ENDPOINT, env.R2_BUCKET, env.R2_ACCESS_KEY_ID, env.R2_SECRET_ACCESS_KEY]
  if (
    env.STORAGE_BACKEND === 'filesystem' &&
    (!env.STORAGE_ROOT || !env.STORAGE_SIGNING_KEY || env.STORAGE_SIGNING_KEY.length < 32)
  ) {
    context.addIssue({
      code: 'custom',
      path: ['STORAGE_ROOT'],
      message: 'Private filesystem storage requires a root and signing key of at least 32 characters',
    })
  }
  if (storage.some(Boolean) && !storage.every(Boolean)) {
    context.addIssue({
      code: 'custom',
      path: ['R2_BUCKET'],
      message: 'Supply all private R2 settings together',
    })
  }
}
