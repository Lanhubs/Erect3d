import { expect, test } from 'bun:test'
import { connectionUnavailable, rememberAccount, rememberedAccount } from '../src/cloud/offline'
import { ErectApi, RemoteError } from '../../api/client'
test('offline identity stores only account identity, rejects invalid state and clears at sign-out', () => {
  let value: string | null = null
  const storage = {
    getItem: () => value,
    setItem: (_key: string, next: string) => {
      value = next
    },
    removeItem: () => {
      value = null
    },
  }
  rememberAccount({ id: 'user_a', name: 'Architect', email: 'architect@example.test' }, storage)
  expect(rememberedAccount(storage)?.id).toBe('user_a')
  expect(Object.keys(JSON.parse(value!))).toEqual(['id', 'name', 'email'])
  value = '{"id":"user_b","csrf":"secret"}'
  expect(rememberedAccount(storage)).toBeNull()
  value = 'invalid'
  expect(rememberedAccount(storage)).toBeNull()
  rememberAccount(null, storage)
  expect(rememberedAccount(storage)).toBeNull()
})
test('connection failures allow cached editing but permissions and credential failures never become offline access', () => {
  for (const status of [502, 503, 504])
    expect(connectionUnavailable(new RemoteError(status, 'UNAVAILABLE', 'Unavailable'))).toBe(true)
  expect(connectionUnavailable(new TypeError('Network failed'))).toBe(true)
  for (const status of [401, 403, 404, 409, 422])
    expect(connectionUnavailable(new RemoteError(status, 'DENIED', 'Denied'))).toBe(false)
})
test('a disconnected reverse proxy without JSON returns a classified connection failure', async () => {
  const api = new ErectApi(
    'https://erect.test',
    (async () => new Response('Bad gateway', { status: 502 })) as typeof fetch,
  )
  try {
    await api.load('project')
    throw new Error('Expected failure')
  } catch (error) {
    expect(error).toBeInstanceOf(RemoteError)
    expect(connectionUnavailable(error)).toBe(true)
  }
})
