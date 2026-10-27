import { expect, test } from 'bun:test'
import { GeminiEditingProvider, assistantModel } from '../src/modules/assistant/provider'
import { editingTools } from '../src/modules/assistant/tools'
import { assistantFailure } from '../src/modules/assistant/failure'
import type { Content } from '@google/genai'
type Transport = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

const history: Content[] = [{ role: 'user', parts: [{ text: 'Furnish this floor' }] }]
test('Argon uses supported generation settings and preserves signed function history', async () => {
  const requests: any[] = []
  const transport = (async (_url: unknown, init: RequestInit) => {
    requests.push(JSON.parse(String(init.body)))
    return Response.json({
      candidates: [
        {
          finishReason: 'STOP',
          content: {
            role: 'model',
            parts: [
              {
                thoughtSignature: 'signed-call',
                functionCall: { id: 'call-1', name: 'inspect_model', args: {} },
              },
            ],
          },
        },
      ],
      usageMetadata: { totalTokenCount: 12 },
    })
  }) as Transport
  const provider = new GeminiEditingProvider('fake-test-key', transport)
  const first = await provider.next('gemini-4-argon', history, editingTools, AbortSignal.timeout(1000))
  await provider.next(
    'gemini-4-argon',
    [
      ...history,
      first.content,
      {
        role: 'user',
        parts: [{ functionResponse: { id: 'call-1', name: 'inspect_model', response: { floors: [] } } }],
      },
    ],
    editingTools,
    AbortSignal.timeout(1000),
  )
  expect(requests[0].generationConfig.temperature).toBeUndefined()
  expect(requests[0].generationConfig.maxOutputTokens).toBe(32768)
  expect(requests[0].generationConfig.thinkingConfig.thinkingLevel).toBe('LOW')
  expect(requests[1].contents[1].parts[0].thoughtSignature).toBe('signed-call')
  expect(requests[1].contents[2].parts[0].functionResponse.id).toBe('call-1')
  expect(first.usage?.totalTokens).toBe(12)
  expect(assistantModel({})).toBe('gemini-4-argon')
  expect(assistantModel({ GEMINI_MODEL_AGENT: 'gemini-3.8-flash' })).toBe('gemini-3.8-flash')
})
test('explicit older model retains its supported settings', async () => {
  let body: any
  const provider = new GeminiEditingProvider('fake-test-key', (async (_url: unknown, init: RequestInit) => {
    body = JSON.parse(String(init.body))
    return Response.json({ candidates: [{ content: { role: 'model', parts: [{ text: 'Which room?' }] } }] })
  }) as Transport)
  await provider.next('gemini-3.8-flash', history, editingTools, AbortSignal.timeout(1000))
  expect(body.generationConfig.temperature).toBe(0)
  expect(body.generationConfig.maxOutputTokens).toBe(16000)
})
test('provider diagnostics classify errors without returning credentials, prompts or private data', async () => {
  for (const [status, code] of [
    [400, 'AI_REQUEST_REJECTED'],
    [401, 'AI_AUTH_FAILED'],
    [404, 'AI_MODEL_UNAVAILABLE'],
    [429, 'AI_QUOTA'],
    [503, 'AI_UPSTREAM'],
  ] as const) {
    const provider = new GeminiEditingProvider('private-key', (async () =>
      Response.json(
        {
          error: { code: status, message: 'private-key private-prompt private-document', status: 'FAILED' },
        },
        { status },
      )) as Transport)
    let failure: unknown
    try {
      await provider.next('gemini-4-argon', history, editingTools, AbortSignal.timeout(1000))
    } catch (error) {
      failure = error
    }
    expect((failure as any).code).toBe(code)
    const diagnostic = JSON.stringify(assistantFailure(failure))
    expect(diagnostic).not.toContain('private-')
    expect(diagnostic).toContain(code)
  }
})
test('empty and truncated responses cannot become completed proposals', async () => {
  for (const [response, code] of [
    [{ candidates: [] }, 'AI_RESPONSE_EMPTY'],
    [
      { candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: 'Partial' }] } }] },
      'AI_RESPONSE_LIMIT',
    ],
  ] as const) {
    const provider = new GeminiEditingProvider('fake-test-key', (async () =>
      Response.json(response)) as Transport)
    await expect(
      provider.next('gemini-4-argon', history, editingTools, AbortSignal.timeout(1000)),
    ).rejects.toMatchObject({ code })
  }
})
