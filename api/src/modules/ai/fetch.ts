import { setTimeout as delay } from 'node:timers/promises'
type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
function dnsFailure(error: unknown): boolean {
  for (let depth = 0; error && typeof error === 'object' && depth < 4; depth++) {
    const item = error as { code?: string; message?: string; cause?: unknown }
    if (
      ['ENOTFOUND', 'EAI_AGAIN'].includes(item.code || '') ||
      /getaddrinfo.*(?:enotfound|eai_again)/i.test(item.message || '')
    )
      return true
    error = item.cause
  }
  return false
}
// A failed DNS lookup occurs before transmission. Do not replay ambiguous socket failures.
export function createProviderFetch(
  fetcher: Fetcher = globalThis.fetch,
  wait: (milliseconds: number, signal?: AbortSignal | null) => Promise<unknown> = (ms, signal) =>
    delay(ms, undefined, { signal: signal || undefined }),
): Fetcher {
  return async (input, init) => {
    for (let attempt = 0; ; attempt++) {
      init?.signal?.throwIfAborted()
      try {
        return await fetcher(input, init)
      } catch (error) {
        if (attempt >= 2 || init?.signal?.aborted || !dnsFailure(error)) throw error
        await wait(250 * 2 ** attempt, init?.signal)
      }
    }
  }
}
export const providerFetch = createProviderFetch()
