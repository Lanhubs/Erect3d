const sensitive = /password|token|secret|credential|authorization|cookie|url|payload|document|prompt/i
let minimumLevel: 'debug' | 'info' | 'error' = 'info'
export function configureLogging(level: typeof minimumLevel) { minimumLevel = level }
function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sensitive.test(key) ? '[REDACTED]' : redact(item)]))
  return value
}
export function log(event: string, fields: Record<string, unknown> = {}) {
  const error = /error|failed|unavailable/.test(event) || typeof fields.status === 'number' && fields.status >= 400
  if (minimumLevel === 'error' && !error) return
  console.log(JSON.stringify({ at: new Date().toISOString(), event, ...redact(fields) as object }))
}
