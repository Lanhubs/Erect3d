import { expect, test } from 'bun:test'
import { readPrivateObject } from '../src/storage/read-object'
import { zipSource, unpackSource } from '../src/storage/archive'

test('bounded private downloads preserve exact archived bytes and forbid redirects', async () => {
  const source = new Uint8Array([0, 255, 1, 128]),
    zip = zipSource(source)
  const request = async (_url: string, options: RequestInit) => {
    expect(options.redirect).toBe('error')
    expect(options.signal).toBeInstanceOf(AbortSignal)
    return new Response(new Uint8Array(zip))
  }
  const downloaded = await readPrivateObject('https://storage.invalid/private', zip.length, request)
  expect(unpackSource('private/source.zip', downloaded, source.length)).toEqual(source)
})
test('length headers and streamed overflow stop private downloads without trusting the server', async () => {
  let cancelled = false
  const body = () =>
    new ReadableStream({
      start(c) {
        c.enqueue(new Uint8Array(10))
      },
      cancel() {
        cancelled = true
      },
    })
  await expect(
    readPrivateObject(
      'https://storage.invalid',
      5,
      async () => new Response(body(), { headers: { 'content-length': '10' } }),
    ),
  ).rejects.toMatchObject({ code: 'ASSET_TOO_LARGE' })
  expect(cancelled).toBe(true)
  cancelled = false
  await expect(
    readPrivateObject('https://storage.invalid', 5, async () => new Response(body())),
  ).rejects.toMatchObject({ code: 'ASSET_TOO_LARGE' })
  expect(cancelled).toBe(true)
})
test('storage errors and timeouts identify storage instead of blaming the interpretation provider', async () => {
  const request = async (_url: string, options: RequestInit) =>
    new Promise<Response>((_resolve, reject) =>
      options.signal!.addEventListener('abort', () => reject(options.signal!.reason), { once: true }),
    )
  const start = Date.now()
  await expect(readPrivateObject('https://storage.invalid', 10, request, 10)).rejects.toMatchObject({
    code: 'STORAGE_UNAVAILABLE',
    status: 503,
  })
  expect(Date.now() - start).toBeLessThan(1000)
  await expect(
    readPrivateObject('https://storage.invalid', 10, async () => new Response(null, { status: 403 })),
  ).rejects.toMatchObject({ code: 'STORAGE_UNAVAILABLE' })
})
