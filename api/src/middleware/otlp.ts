import type { TelemetrySink } from './telemetry'

// Explicit OTLP/HTTP JSON export avoids automatic instrumentation of SQL, prompts or source files.
type Transport = (url: string, init: RequestInit) => Promise<Response>
type RecordValue = {
  timeUnixNano: string
  severityNumber: number
  severityText: string
  body: { stringValue: string }
  attributes: unknown[]
}
const allowed = new Set([
  'method',
  'status',
  'elapsedMs',
  'active',
  'kind',
  'code',
  'jobId',
  'requestId',
  'projectId',
  'retryable',
])
export class OtlpSink implements TelemetrySink {
  private queue: RecordValue[] = []
  private active?: Promise<void>
  private controller?: AbortController
  private stopped = false
  private timer: ReturnType<typeof setInterval>
  dropped = 0
  constructor(
    private endpoint: string,
    private service: string,
    private send: Transport = fetch,
  ) {
    this.timer = setInterval(() => void this.flush(), 1000)
    this.timer.unref()
  }
  record(event: string, fields: Record<string, string | number>) {
    if (this.stopped) return
    if (this.queue.length >= 64) {
      this.dropped++
      return
    }
    const failed =
      event === 'error' ||
      fields.status === 'failed' ||
      (typeof fields.status === 'number' && fields.status >= 500)
    this.queue.push({
      timeUnixNano: String(BigInt(Date.now()) * 1000000n),
      severityNumber: failed ? 17 : 9,
      severityText: failed ? 'ERROR' : 'INFO',
      body: { stringValue: `erect3d.${event}` },
      attributes: Object.entries(fields)
        .filter(([key]) => allowed.has(key))
        .slice(0, 12)
        .map(([key, value]) => ({
          key,
          value:
            typeof value === 'number' ? { doubleValue: value } : { stringValue: String(value).slice(0, 200) },
        })),
    })
  }
  flush(): Promise<void> {
    if (this.active) return this.active
    if (!this.queue.length || this.stopped) return Promise.resolve()
    const batch = this.queue.splice(0, 16),
      controller = new AbortController()
    this.controller = controller
    const timeout = setTimeout(() => controller.abort(), 2000)
    timeout.unref()
    this.active = Promise.resolve()
      .then(async () => {
        if (this.stopped) return
        try {
          const response = await this.send(this.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            redirect: 'error',
            body: JSON.stringify({
              resourceLogs: [
                {
                  resource: { attributes: [{ key: 'service.name', value: { stringValue: this.service } }] },
                  scopeLogs: [{ scope: { name: 'erect3d.explicit-events' }, logRecords: batch }],
                },
              ],
            }),
          })
          if (!response.ok) this.dropped += batch.length
          await response.body?.cancel()
        } catch {
          this.dropped += batch.length
        }
      })
      .finally(() => {
        clearTimeout(timeout)
        this.active = undefined
        this.controller = undefined
      })
    return this.active
  }
  close() {
    this.stopped = true
    clearInterval(this.timer)
    this.controller?.abort()
    this.queue.length = 0
  }
}
