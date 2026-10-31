import { pino } from 'pino'

type Level = 'debug' | 'info' | 'warn' | 'error'
type Fields = Record<string, unknown>
const priority: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 }
const sensitive =
  /password|token|secret|credential|authorization|cookie|url|payload|document|prompt|message|stack|sql|email|body|api.?key|access.?key|session|connection.?string|dsn/i

/** Credential and connection strings never leave the process, whichever sink consumes them. */
export function scrubText(value: string) {
  return value
    .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/(?:https?|postgres(?:ql)?|redis):\/\/[^\s]+/gi, '[REDACTED URL]')
}

export function redact(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (depth > 6) return '[TRUNCATED]'
  if (value instanceof Error) {
    const code =
      'code' in value && /^[A-Z0-9_]{1,80}$/.test(String(value.code)) ? value.code : 'UNEXPECTED_ERROR'
    return { name: 'Error', code }
  }
  if (value && typeof value === 'object') {
    if (seen.has(value)) return '[CIRCULAR]'
    seen.add(value)
    if (Array.isArray(value)) return value.slice(0, 50).map((item) => redact(item, depth + 1, seen))
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 50)
        .map(([key, item]) => [key, sensitive.test(key) ? '[REDACTED]' : redact(item, depth + 1, seen)]),
    )
  }
  if (typeof value === 'string') return scrubText(value).slice(0, 512)
  if (typeof value === 'bigint') return String(value)
  return value
}

/**
 * Pino is the emitter; the repository's own log contract is the shape below. `event` carries the
 * message, `at` the ISO instant and `level` the label rather than pino's numeric severity, because
 * collectors, `docs/OBSERVABILITY.md` and the tests read those keys.
 */
function emitter(minimum: Level, write: (line: string) => void) {
  return pino(
    {
      level: minimum,
      base: null,
      messageKey: 'event',
      formatters: { level: (label: string) => ({ level: label }) },
      timestamp: () => `,"at":"${new Date().toISOString()}"`,
    },
    {
      write: (chunk: string) => {
        try {
          write(chunk.endsWith('\n') ? chunk.slice(0, -1) : chunk)
        } catch {
          /* Diagnostics must not interrupt requests, commits or worker leases. */
        }
      },
    },
  )
}

export function createLogger(
  minimum: Level = 'info',
  write: (line: string) => void = (line) => process.stdout.write(`${line}\n`),
) {
  const log = emitter(minimum, write)
  return (event: string, fields: Fields = {}, level?: Level) => {
    const status = typeof fields.status === 'number' ? fields.status : 0
    const resolved =
      level ||
      (/error|failed|unavailable/.test(event) || status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info')
    if (priority[resolved] < priority[minimum]) return
    log[resolved](redact(fields) as Fields, event)
  }
}
let logger = createLogger()
export function configureLogging(level: Level, write?: (line: string) => void) {
  logger = createLogger(level, write)
}
export function log(event: string, fields: Fields = {}, level?: Level) {
  logger(event, fields, level)
}
