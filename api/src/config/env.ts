import { z } from 'zod'
import { validateConfiguration } from './validate'

const optionalText = z.preprocess((value) => (value === '' ? undefined : value), z.string().min(1).optional())
const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PUBLIC_REGISTRATION: z.enum(['true', 'false']).optional(),
    HOST: z.string().default('127.0.0.1'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    DATABASE_URL: z.string().url(),
    DATABASE_TLS: z.enum(['disable', 'verify-full']).default('disable'),
    DATABASE_CA_FILE: optionalText,
    DATABASE_SERVER_NAME: optionalText,
    DB_POOL_SIZE: z.coerce.number().int().min(1).max(100).default(10),
    ALLOWED_ORIGINS: z.string().default('http://localhost:5173,http://127.0.0.1:5173'),
    COOKIE_NAME: z
      .string()
      .regex(/^[a-zA-Z0-9_-]+$/)
      .default('erect_session'),
    SESSION_IDLE_SECONDS: z.coerce.number().int().positive().default(86400),
    SESSION_ABSOLUTE_SECONDS: z.coerce.number().int().positive().default(2592000),
    REDIS_URL: optionalText,
    RATE_LIMIT_BACKEND: z.enum(['postgres', 'redis']).default('postgres'),
    R2_ENDPOINT: optionalText,
    R2_BUCKET: optionalText,
    R2_REGION: z.literal('auto').default('auto'),
    R2_ACCESS_KEY_ID: optionalText,
    R2_SECRET_ACCESS_KEY: optionalText,
    STORAGE_BACKEND: z.enum(['r2', 'filesystem']).default('r2'),
    STORAGE_ROOT: optionalText,
    STORAGE_SIGNING_KEY: optionalText,
    PDF_OPTIMIZER_PATH: optionalText,
    ASSET_OPTIMIZE_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(30000),
    DWG_CONVERTER_PATH: optionalText,
    DXF_TO_DWG_CONVERTER_PATH: optionalText,
    CAD_MAX_BYTES: z.coerce.number().int().min(1_048_576).max(67_108_864).default(33_554_432),
    CAD_CONVERT_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(180_000).default(60_000),
    CAD_MAX_ENTITIES: z.coerce.number().int().min(1_000).max(1_000_000).default(200_000),
    GEMINI_API_KEY: optionalText,
    GEMINI_MODEL_AGENT: optionalText,
    GEMINI_MODEL_REPAIR: optionalText,
    GEMINI_MODEL_PLAN: z.string().default('gemini-3.8-flash'),
    GEMINI_MODEL_FAST: z.string().default('gemini-3.5-flash-lite'),
    GEMINI_MODEL_COMPLEX: z.string().default('gemini-3.8-flash'),
    AI_DAILY_LIMIT: z.coerce.number().int().min(1).max(10000).default(25),
    AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(300000).default(90000),
    MAX_UPLOAD_BYTES: z.coerce.number().int().positive().max(209715200).default(209715200),
    MAX_PROJECT_BYTES: z.coerce.number().int().min(1048576).max(134217728).default(33554432),
    SNAPSHOT_INTERVAL: z.coerce.number().int().min(1).max(10000).default(50),
    WORKER_POLL_MS: z.coerce.number().int().min(100).max(30000).default(1000),
    WORKER_LEASE_SECONDS: z.coerce.number().int().min(30).max(600).default(120),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    SENTRY_DSN: optionalText,
    SENTRY_RELEASE: optionalText,
    OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: optionalText,
    OTEL_SERVICE_NAME: z.string().min(1).max(100).default('erect3d-api'),
    TRUSTED_PROXY_IPS: z.string().default(''),
  })
  .superRefine(validateConfiguration)
export type Config = z.infer<typeof schema>
export function readConfig(input: Record<string, unknown> = process.env): Config {
  const parsed = schema.safeParse(input)
  if (!parsed.success)
    throw new Error(
      `Invalid API configuration: ${parsed.error.issues.map((issue) => issue.path.join('.')).join(', ')}`,
    )
  return parsed.data
}
