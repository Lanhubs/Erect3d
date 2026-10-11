import { z } from 'zod'
import { isIP } from 'node:net'

const optionalText = z.preprocess(value => value === '' ? undefined : value, z.string().min(1).optional())
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PUBLIC_REGISTRATION: z.enum(['true','false']).optional(),
  HOST: z.string().default('127.0.0.1'), PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().url(), DATABASE_TLS: z.enum(['disable', 'verify-full']).default('disable'),
  DATABASE_CA_FILE: optionalText, DATABASE_SERVER_NAME: optionalText,
  DB_POOL_SIZE: z.coerce.number().int().min(1).max(100).default(10),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173,http://127.0.0.1:5173'),
  COOKIE_NAME: z.string().regex(/^[a-zA-Z0-9_-]+$/).default('erect_session'),
  SESSION_IDLE_SECONDS: z.coerce.number().int().positive().default(86400),
  SESSION_ABSOLUTE_SECONDS: z.coerce.number().int().positive().default(2592000),
  REDIS_URL: optionalText, RATE_LIMIT_BACKEND: z.enum(['postgres', 'redis']).default('postgres'),
  S3_ENDPOINT: optionalText, S3_BUCKET: optionalText, S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY_ID: optionalText, S3_SECRET_ACCESS_KEY: optionalText,
  GEMINI_API_KEY: optionalText, GEMINI_MODEL_PLAN: z.string().default('gemini-3.8-flash'),
  GEMINI_MODEL_FAST: z.string().default('gemini-3.5-flash-lite'), GEMINI_MODEL_COMPLEX: z.string().default('gemini-3.8-flash'),
  AI_DAILY_LIMIT: z.coerce.number().int().min(1).max(10000).default(25),
  AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(300000).default(90000),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().max(209715200).default(209715200),
  MAX_PROJECT_BYTES:z.coerce.number().int().min(1048576).max(134217728).default(33554432),
  SNAPSHOT_INTERVAL: z.coerce.number().int().min(1).max(10000).default(50),
  WORKER_POLL_MS: z.coerce.number().int().min(100).max(30000).default(1000),
  WORKER_LEASE_SECONDS: z.coerce.number().int().min(30).max(600).default(120),
  LOG_LEVEL: z.enum(['debug', 'info', 'error']).default('info'),
  TRUSTED_PROXY_IPS:z.string().default(''),
}).superRefine((env, context) => {
  try {
    if (!['postgres:','postgresql:'].includes(new URL(env.DATABASE_URL).protocol)) throw new Error()
  } catch {
    context.addIssue({ code:'custom',path:['DATABASE_URL'],message:'Use a PostgreSQL connection URL' })
  }
  if (env.REDIS_URL) {
    try {
      if (!['redis:','rediss:'].includes(new URL(env.REDIS_URL).protocol)) throw new Error()
    } catch { context.addIssue({ code:'custom',path:['REDIS_URL'],message:'Use a Redis connection URL' }) }
  }
  if (env.TRUSTED_PROXY_IPS.split(',').filter(Boolean).some(value => !isIP(value.trim()))) {
    context.addIssue({ code:'custom',path:['TRUSTED_PROXY_IPS'],message:'Use exact proxy IP addresses' })
  }
  if (env.S3_ENDPOINT) {
    try {
      const endpoint = new URL(env.S3_ENDPOINT)
      if (!['http:','https:'].includes(endpoint.protocol) || env.NODE_ENV==='production' && endpoint.protocol!=='https:') throw new Error()
    } catch { context.addIssue({ code:'custom',path:['S3_ENDPOINT'],message:'Use a storage HTTP URL; production requires HTTPS' }) }
  }
  const origins = env.ALLOWED_ORIGINS.split(',').map(value => value.trim())
  if (origins.some(value => { try { return new URL(value).origin !== value } catch { return true } })) {
    context.addIssue({ code: 'custom', path: ['ALLOWED_ORIGINS'], message: 'Use exact origins, without paths or wildcards' })
  }
  if (env.NODE_ENV === 'production') {
    if (env.DATABASE_TLS !== 'verify-full') context.addIssue({ code: 'custom', path: ['DATABASE_TLS'], message: 'Production requires verified database TLS' })
    if (origins.some(value => !value.startsWith('https://'))) context.addIssue({ code: 'custom', path: ['ALLOWED_ORIGINS'], message: 'Production origins require HTTPS' })
    if (!env.S3_BUCKET) context.addIssue({ code:'custom',path:['S3_BUCKET'],message:'Production requires private object storage' })
  }
  if (env.RATE_LIMIT_BACKEND === 'redis' && !env.REDIS_URL) {
    context.addIssue({ code: 'custom', path: ['REDIS_URL'], message: 'Redis rate limits require REDIS_URL' })
  }
  const storage = [env.S3_ENDPOINT, env.S3_BUCKET, env.S3_ACCESS_KEY_ID, env.S3_SECRET_ACCESS_KEY]
  if (storage.some(Boolean) && !storage.every(Boolean)) {
    context.addIssue({ code: 'custom', path: ['S3_BUCKET'], message: 'Supply all private S3 settings together' })
  }
})
export type Config = z.infer<typeof schema>
export function readConfig(input: Record<string, unknown> = process.env): Config {
  const parsed = schema.safeParse(input)
  if (!parsed.success) throw new Error(`Invalid API configuration: ${parsed.error.issues.map(issue => issue.path.join('.')).join(', ')}`)
  return parsed.data
}
