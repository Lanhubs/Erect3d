import { expect, test } from 'bun:test'
import { createProviderFetch } from '../src/modules/ai/fetch'
import { presentAnalysis } from '../src/modules/plan-analysis/presentation'
import { presentRun } from '../src/modules/assistant/presentation'
import { classifyFailure } from '../src/modules/ai/provider'
const dnsError = () =>
  Object.assign(new TypeError('getaddrinfo ENOTFOUND generativelanguage.googleapis.com'), {
    code: 'ENOTFOUND',
  })
test('temporary DNS failure recovers without changing URL, headers or body', async () => {
  let calls = 0
  const pauses: number[] = [],
    init = { method: 'POST', headers: { 'x-goog-api-key': 'fixture' }, body: 'drawing' }
  const fetcher = createProviderFetch(
    async (url, options) => {
      expect(url).toBe('https://generativelanguage.googleapis.com/test')
      expect(options).toBe(init)
      if (++calls < 3) throw dnsError()
      return new Response('ok')
    },
    async (ms) => {
      pauses.push(ms)
    },
  )
  expect(await (await fetcher('https://generativelanguage.googleapis.com/test', init)).text()).toBe('ok')
  expect(calls).toBe(3)
  expect(pauses).toEqual([250, 500])
})
test('persistent DNS failure has a bounded number of attempts', async () => {
  let calls = 0
  const error = dnsError()
  const fetcher = createProviderFetch(
    async () => {
      calls++
      throw error
    },
    async () => {},
  )
  await expect(fetcher('https://example.test')).rejects.toBe(error)
  expect(calls).toBe(3)
  expect(classifyFailure(error).code).toBe('AI_NETWORK')
})
test('nested temporary resolver errors are retried', async () => {
  let calls = 0
  const fetcher = createProviderFetch(
    async () => {
      if (++calls === 1) throw new TypeError('fetch failed', { cause: { code: 'EAI_AGAIN' } })
      return new Response('ok')
    },
    async () => {},
  )
  await fetcher('https://example.test')
  expect(calls).toBe(2)
})
test('socket failures are not replayed after possibly sending a request', async () => {
  let calls = 0
  const error = Object.assign(new TypeError('socket reset'), { code: 'ECONNRESET' })
  const fetcher = createProviderFetch(
    async () => {
      calls++
      throw error
    },
    async () => {},
  )
  await expect(fetcher('https://example.test')).rejects.toBe(error)
  expect(calls).toBe(1)
})
test('HTTP errors remain the SDK responsibility without duplicate requests', async () => {
  let calls = 0
  const fetcher = createProviderFetch(
    async () => {
      calls++
      return new Response(null, { status: 403 })
    },
    async () => {},
  )
  expect((await fetcher('https://example.test')).status).toBe(403)
  expect(calls).toBe(1)
})
test('cancellation during DNS backoff prevents another request', async () => {
  const controller = new AbortController()
  let calls = 0
  const fetcher = createProviderFetch(
    async () => {
      calls++
      throw dnsError()
    },
    async () => {
      controller.abort()
    },
  )
  await expect(fetcher('https://example.test', { signal: controller.signal })).rejects.toThrow()
  expect(calls).toBe(1)
})
test('analysis exposes review data but no provider settings, hashes or provenance', () => {
  const proposal = { candidates: [] },
    region = { x: 0, y: 0, width: 1, height: 1 }
  const row = {
    id: 'analysis',
    status: 'ready',
    job_status: 'completed',
    model: 'private-model',
    prompt_version: 35,
    schema_version: 5,
    source_hash: 'private-hash',
    cache_key: 'cache',
    actor_id: 'private-actor',
    model_revision: '7',
    options: {
      engine: 'backend',
      purpose: 'rebuild',
      region,
      designMode: 'creative',
      styleReferenceAssetId: 'reference',
      cloudConsent: true,
      mode: 'full',
      complex: false,
      strategy: 'direct',
    },
    result: {
      proposal,
      quality: { status: 'valid' },
      provenance: { model: 'secret' },
      calibration: { metresPerPixel: 1 },
      dimensions: { width: 100, height: 100 },
    },
  }
  const result = presentAnalysis(row, 35)
  expect(result.result?.proposal).toBe(proposal)
  expect(result.model_revision).toBe('7')
  expect(result.isCurrent).toBe(true)
  expect(presentAnalysis(row, 36).isCurrent).toBe(false)
  expect(result.options).toEqual({
    engine: 'backend',
    purpose: 'rebuild',
    region,
    designMode: 'creative',
    styleReferenceAssetId: 'reference',
  })
  for (const key of [
    'model',
    'prompt_version',
    'schema_version',
    'source_hash',
    'cache_key',
    'actor_id',
    'currentPromptVersion',
  ])
    expect(result).not.toHaveProperty(key)
  expect(result.result).not.toHaveProperty('provenance')
})
test('pending analysis has no fabricated proposal', () => {
  expect(presentAnalysis({ status: 'pending' }, 35).result).toBeNull()
})
test('assistant keeps proposal and stale checks without internal usage or ownership data', () => {
  const result = presentRun(
    {
      id: 'run',
      status: 'ready',
      base_revision: '7',
      applied_revision: null,
      scope: { mode: 'level' },
      proposal: { changes: [] },
      usage: { tokens: 999 },
      actor_id: 'actor',
      thread_id: 'thread',
    },
    8,
  )
  expect(result?.status).toBe('stale')
  expect(result?.base_revision).toBe(7)
  expect(result).toHaveProperty('proposal', { changes: [] })
  for (const key of ['usage', 'actor_id', 'thread_id']) expect(result).not.toHaveProperty(key)
})
