import { afterAll, expect, test } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import { relative, resolve } from 'node:path'
import sharp from 'sharp'
import { PrivateFilesystem } from '../src/storage/filesystem'
import { account, createProject, harness, origin, request } from './helpers'
const root = resolve('.local', `filesystem-test-${crypto.randomUUID()}`),
  store = new PrivateFilesystem(root, 's'.repeat(64)),
  h = harness({ store })
await mkdir(root, { recursive: true })
afterAll(async () => {
  h.limits.close()
  await h.db.close()
  if (!relative(resolve('.local'), root).startsWith('filesystem-test-'))
    throw new Error('Unexpected test cleanup path')
  await rm(root, { recursive: true, force: true })
})
test('private filesystem tickets enforce signatures, methods, expiry, allowed origins, MIME and safe object paths', async () => {
  const key = 'private/test/upload.png',
    url = store.uploadUrl(key, 'image/png'),
    token = url.split('/').at(-1)!
  expect(store.verify(token, 'PUT').key).toBe(key)
  expect(() => store.verify(token, 'GET')).toThrow('expired or has the wrong method')
  expect(() => store.verify(token.slice(0, -1) + '!', 'PUT')).toThrow('invalid')
  expect(() => store.uploadUrl('../outside', 'image/png')).toThrow('Invalid object key')
  expect(() => store.uploadUrl('private//outside', 'image/png')).toThrow('Invalid object key')
  const original = Date.now
  Date.now = () => original() + 301000
  try {
    expect(() => store.verify(token, 'PUT')).toThrow('expired')
  } finally {
    Date.now = original
  }
  expect(
    (
      await h.app.request(url, {
        method: 'PUT',
        headers: { Origin: 'https://foreign.test', 'Content-Type': 'image/png' },
        body: 'x',
      })
    ).status,
  ).toBe(403)
  expect(
    (
      await h.app.request(url, {
        method: 'PUT',
        headers: { Origin: origin, 'Content-Type': 'text/plain' },
        body: 'x',
      })
    ).status,
  ).toBe(422)
  expect((await h.app.request('/private-assets/not-a-ticket')).status).toBe(403)
  expect((await h.app.request(store.downloadUrl('private/test/missing'))).status).toBe(404)
})
test('client upload URLs accept large binary bodies, finalize to immutable compact objects and downloads preserve plan pixels', async () => {
  const user = await account(h.app),
    project = await createProject(h.app, user)
  const bytes = await sharp({ create: { width: 100, height: 100, channels: 3, background: 'white' } })
    .png()
    .toBuffer()
  const created = await request(h.app, user, `/projects/${project.id}/assets/uploads`, 'POST', {
    name: 'Synthetic.png',
    mime: 'image/png',
    size: bytes.length,
    kind: 'source',
  })
  expect(created.status).toBe(201)
  const upload = await created.json()
  expect(
    (
      await h.app.request(upload.uploadUrl, {
        method: 'PUT',
        headers: { Origin: origin, 'Content-Type': 'image/png' },
        body: new Uint8Array(bytes),
      })
    ).status,
  ).toBe(204)
  expect(
    (await request(h.app, user, `/projects/${project.id}/assets/${upload.assetId}/finalize`, 'POST')).status,
  ).toBe(200)
  const [asset] = await h.db`SELECT object_key FROM assets WHERE id=${upload.assetId}`
  const stored = await store.read(asset.object_key, 10000)
  expect(stored.length).toBeLessThanOrEqual(bytes.length)
  expect(await sharp(stored).raw().toBuffer()).toEqual(await sharp(bytes).raw().toBuffer())
  await h.app.request(upload.uploadUrl, {
    method: 'PUT',
    headers: { Origin: origin, 'Content-Type': 'image/png' },
    body: new Uint8Array([1, 2]),
  })
  expect(await store.read(asset.object_key, 10000)).toEqual(stored)
  const download = await (
    await request(h.app, user, `/projects/${project.id}/assets/${upload.assetId}/download`)
  ).json()
  expect(new Uint8Array(await (await h.app.request(download.downloadUrl)).arrayBuffer())).toEqual(stored)
  const large = new Uint8Array(3 * 1024 * 1024),
    largeUrl = store.uploadUrl('private/test/large.bin', 'application/octet-stream')
  expect(
    (
      await h.app.request(largeUrl, {
        method: 'PUT',
        headers: { Origin: origin, 'Content-Type': 'application/octet-stream' },
        body: large,
      })
    ).status,
  ).toBe(204)
  await expect(store.read('private/test/large.bin', 1000)).rejects.toThrow('exceeded')
})
