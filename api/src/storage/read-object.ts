import { ApiError } from '../security/errors'

// Keep private downloads bounded in bytes and time. Do not log signed URLs.
export async function readPrivateObject(
  url: string,
  maximum: number,
  request: (url: string, options: RequestInit) => Promise<Response> = fetch,
  timeoutMS = 30000,
) {
  if (!Number.isSafeInteger(maximum) || maximum < 1) throw new Error('Invalid private object read limit')
  const signal = AbortSignal.timeout(timeoutMS)
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  try {
    const response = await request(url, { signal, redirect: 'error' })
    if (!response.ok || !response.body)
      throw new ApiError(
        503,
        'STORAGE_UNAVAILABLE',
        'Private file storage could not return this source. Please retry shortly.',
      )
    const length = Number(response.headers.get('content-length'))
    if (length > maximum) {
      await response.body.cancel().catch(() => {})
      throw new ApiError(413, 'ASSET_TOO_LARGE', 'Object exceeded its permitted size')
    }
    reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.length
      if (total > maximum) throw new ApiError(413, 'ASSET_TOO_LARGE', 'Object exceeded its permitted size')
      chunks.push(value)
    }
    const bytes = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.length
    }
    return bytes
  } catch (error) {
    if (reader) await reader.cancel().catch(() => {})
    if (error instanceof ApiError) throw error
    throw new ApiError(
      503,
      'STORAGE_UNAVAILABLE',
      'Private file storage could not be reached. Please retry shortly.',
    )
  } finally {
    reader?.releaseLock()
  }
}
