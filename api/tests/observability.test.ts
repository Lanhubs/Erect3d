import { expect, test } from 'bun:test'
import { createLogger } from '../src/security/log'
import { OtlpSink } from '../src/middleware/otlp'
import { report } from '../src/middleware/telemetry'
import { readConfig } from '../src/config/env'
import { ProviderFailure } from '../src/modules/ai/provider'

test('structured errors preserve correlation and classification without source or credential disclosure', () => {
  const lines: string[] = [],
    logger = createLogger('info', (line) => lines.push(line))
  const circular: Record<string, unknown> = {}
  circular.self = circular
  logger('job.failed', {
    jobId: 'job_1',
    projectId: 'project_1',
    requestId: 'request_1',
    code: 'AI_UPSTREAM',
    failure: new ProviderFailure('AI_UPSTREAM', true),
    prompt: 'private drawing',
    apiKey: 'private-api-key',
    sessionId: 'private-session-cookie',
    nested: { authorization: 'Bearer private-key', sourceUrl: 'https://private.example' },
    context: 'postgres://user:private-password@localhost/db',
    circular,
  })
  const row = JSON.parse(lines[0])
  expect(row).toMatchObject({
    event: 'job.failed',
    level: 'error',
    jobId: 'job_1',
    projectId: 'project_1',
    requestId: 'request_1',
  })
  expect(row.failure.code).toBe('AI_UPSTREAM')
  expect(row.at).toBeString()
  for (const secret of [
    'private drawing',
    'private-key',
    'private-password',
    'private.example',
    'private-api-key',
    'private-session-cookie',
  ])
    expect(lines[0]).not.toContain(secret)
  expect(row.circular.self).toBe('[CIRCULAR]')
})

test('severity filtering works and logging failure cannot interrupt an operation', () => {
  const lines: string[] = [],
    logger = createLogger('error', (line) => lines.push(line))
  logger('http.request', { status: 200 })
  logger('http.request', { status: 403 })
  logger('http.request', { status: 500 })
  expect(lines).toHaveLength(1)
  expect(JSON.parse(lines[0]).level).toBe('error')
  expect(() =>
    createLogger('debug', () => {
      throw new Error('disk full')
    })('job.failed'),
  ).not.toThrow()
  expect(() =>
    report(
      {
        record() {
          throw new Error('collector failed')
        },
      },
      'job',
      { status: 'failed' },
    ),
  ).not.toThrow()
})

test('OTLP batches are bounded, omit private fields and serialize concurrent flushes', async () => {
  const bodies: string[] = []
  let release!: (response: Response) => void
  const transport = () =>
    new Promise<Response>((resolve) => {
      release = resolve
    })
  const sink = new OtlpSink('http://localhost:4318/v1/logs', 'test-api', transport)
  try {
    for (let n = 0; n < 80; n++)
      sink.record('job', { status: 'failed', code: 'AI_UPSTREAM', jobId: 'job_1', prompt: 'private source' })
    expect(sink.dropped).toBe(16)
    const first = sink.flush()
    expect(sink.flush()).toBe(first)
    await Promise.resolve()
    release(new Response(null, { status: 200 }))
    await first
    sink.close()
    const inspect = new OtlpSink('http://localhost:4318/v1/logs', 'test-api', async (_url, init) => {
      bodies.push(String(init?.body))
      return new Response(null, { status: 200 })
    })
    inspect.record('error', { status: 500, code: 'INTERNAL_ERROR', prompt: 'private source' })
    await inspect.flush()
    inspect.close()
    expect(bodies[0]).not.toContain('private source')
    const batch = JSON.parse(bodies[0]).resourceLogs[0]
    expect(batch.resource.attributes[0].value.stringValue).toBe('test-api')
    expect(batch.scopeLogs[0].logRecords[0].severityText).toBe('ERROR')
  } finally {
    sink.close()
  }
})

test('unavailable collectors drop a bounded batch without retrying or rejecting', async () => {
  let calls = 0
  const sink = new OtlpSink('http://localhost:4318/v1/logs', 'test', async () => {
    calls++
    throw new Error('unreachable')
  })
  try {
    sink.record('request', { status: 200 })
    await sink.flush()
    await sink.flush()
    expect(calls).toBe(1)
    expect(sink.dropped).toBe(1)
    sink.close()
    sink.record('request', { status: 200 })
    await sink.flush()
    expect(calls).toBe(1)
  } finally {
    sink.close()
  }
})

test('OTLP remains optional and rejects non-HTTP endpoints or embedded credentials', () => {
  const base = { DATABASE_URL: 'postgres://fixture:fixture@localhost/fixture_test' }
  expect(readConfig(base).OTEL_EXPORTER_OTLP_LOGS_ENDPOINT).toBeUndefined()
  for (const endpoint of [
    'file:///tmp/log',
    'https://user:password@example.test/v1/logs',
    'https://example.test/v1/logs?key=secret',
  ]) {
    expect(() => readConfig({ ...base, OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: endpoint })).toThrow('OTEL_EXPORTER')
  }
})

test('closing an exporter cancels an in-flight send and never sends queued work afterward', async () => {
  let aborted = false
  const sink = new OtlpSink('http://localhost:4318/v1/logs', 'test', async (_url, init) => {
    return new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener(
        'abort',
        () => {
          aborted = true
          reject(new Error('aborted'))
        },
        { once: true },
      )
    })
  })
  sink.record('request', { status: 200 })
  const work = sink.flush()
  await Promise.resolve()
  sink.close()
  await work
  expect(aborted).toBe(true)
  let sent = false
  const queued = new OtlpSink('http://localhost:4318/v1/logs', 'test', async () => {
    sent = true
    return new Response(null)
  })
  queued.record('request', { status: 200 })
  const pending = queued.flush()
  queued.close()
  await pending
  expect(sent).toBe(false)
})
