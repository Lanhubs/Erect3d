type Level = 'debug' | 'info' | 'warn' | 'error'
type Fields = Record<string, unknown>
const priority: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 }
const sensitive =
  /password|token|secret|credential|authorization|cookie|url|payload|document|prompt|message|stack|sql|email|body|api.?key|access.?key|session|connection.?string|dsn/i

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
  if (typeof value === 'string') {
    return value
      .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
      .replace(/(?:https?|postgres(?:ql)?|redis):\/\/[^\s]+/gi, '[REDACTED URL]')
      .slice(0, 512)
  }
  if (typeof value === 'bigint') return String(value)
  return value
}

export function createLogger(
  minimum: Level = 'info',
  write: (line: string) => void = (line) => console.log(line),
) {
  return (event: string, fields: Fields = {}, level?: Level) => {
    const status = typeof fields.status === 'number' ? fields.status : 0
    const resolved =
      level ||
      (/error|failed|unavailable/.test(event) || status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info')
    if (priority[resolved] < priority[minimum]) return
    try {
      write(
        JSON.stringify({
          ...(redact(fields) as Fields),
          at: new Date().toISOString(),
          level: resolved,
          event,
        }),
      )
    } catch {
      /* Diagnostics must not interrupt requests, commits or worker leases. */
    }
  }
}
let logger = createLogger()
export function configureLogging(level: Level) {
  logger = createLogger(level)
}
export function log(event: string, fields: Fields = {}, level?: Level) {
  logger(event, fields, level)
}
