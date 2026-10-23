import { afterAll, beforeAll, expect, test } from 'bun:test'
import { account, createProject, harness, request, type Account } from './helpers'
const h = harness()
let owner: Account, outsider: Account
beforeAll(async () => {
  owner = await account(h.app)
  outsider = await account(h.app)
})
afterAll(async () => {
  h.limits.close()
  await h.db.close()
})
test('plan preview is private, cached by revision and invalidated by geometry edits', async () => {
  const document = await createProject(h.app, owner),
    path = `/projects/${document.id}/plan-preview`
  expect((await h.app.request(`/api/v1${path}`)).status).toBe(401)
  const response = await request(h.app, owner, path),
    preview = await response.json(),
    etag = response.headers.get('ETag')!
  expect(response.status).toBe(200)
  expect(response.headers.get('Cache-Control')).toBe('private, no-cache')
  expect(preview.revision).toBe(0)
  expect(preview.svg).toContain('<svg')
  expect(preview.document).toBeUndefined()
  expect((await request(h.app, owner, path, 'GET', undefined, { 'If-None-Match': etag })).status).toBe(304)
  expect((await request(h.app, outsider, path, 'GET', undefined, { 'If-None-Match': etag })).status).toBe(404)
  const building = document.buildings[0],
    level = building.levels[0],
    wall = level.walls[0]
  expect(
    (
      await request(h.app, owner, `/projects/${document.id}/operations`, 'POST', {
        operationId: crypto.randomUUID(),
        baseRevision: 0,
        type: 'document.patch',
        entityId: wall.id,
        payload: {
          changes: [
            {
              action: 'put',
              path: ['buildings', building.id, 'levels', level.id, 'walls', wall.id, 'end'],
              value: { x: 12, z: 0 },
            },
          ],
        },
      })
    ).status,
  ).toBe(200)
  const changed = await request(h.app, owner, path),
    next = await changed.json()
  expect(next.revision).toBe(1)
  expect(next.svg).not.toBe(preview.svg)
  expect(changed.headers.get('ETag')).not.toBe(etag)
  await request(h.app, owner, `/projects/${document.id}`, 'DELETE')
  expect(
    (await request(h.app, owner, path, 'GET', undefined, { 'If-None-Match': changed.headers.get('ETag')! }))
      .status,
  ).toBe(404)
})
