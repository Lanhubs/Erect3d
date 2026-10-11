import { expect, test } from 'bun:test'
import { SessionApi } from '../src/cloud/sessionApi'
test('two tabs serialize rotating session tokens and mutations without credential persistence', async () => {
  let serial = Promise.resolve(), token = '', rotations = 0, applied = 0
  const lock = <T>(_name: string, action: () => Promise<T>) => {
    const task = serial.then(action); serial = task.then(() => {}, () => {}); return task
  }
  const fetcher = (async (url, init) => {
    if (String(url).endsWith('/auth/session')) {
      token = `csrf-${++rotations}`
      await new Promise(resolve => setTimeout(resolve, 2))
      return Response.json({ user: { id: 'user_same' }, csrfToken: token })
    }
    expect(new Headers(init?.headers).get('X-CSRF-Token')).toBe(token)
    expect(init?.credentials).toBe('include'); applied++
    return Response.json({ okay: true })
  }) as typeof fetch
  const options = { lock, actor: () => 'user_same', expired: () => { throw new Error('Unexpected expiry') }, fetcher }
  const a = new SessionApi('https://erect.test', options), b = new SessionApi('https://erect.test', options)
  await Promise.all([a.request('/projects/a', 'POST', {}), b.session(), b.request('/projects/b', 'POST', {}), a.request('/projects/c', 'POST', {})])
  expect(applied).toBe(3); expect(rotations).toBe(4)
})
test('a shared cookie switched to another account blocks the frozen mutation', async () => {
  let applied = 0, expired = false
  const api = new SessionApi('https://erect.test', {
    lock: async (_name, action) => action(), actor: () => 'user_previous', expired: () => { expired = true },
    fetcher: (async url => {
      if (String(url).endsWith('/auth/session')) return Response.json({ user: { id: 'user_other' }, csrfToken: 'token' })
      applied++; return Response.json({})
    }) as typeof fetch,
  })
  await expect(api.request('/projects/p/operations', 'POST', {})).rejects.toThrow('account changed')
  expect(applied).toBe(0); expect(expired).toBe(true)
})
