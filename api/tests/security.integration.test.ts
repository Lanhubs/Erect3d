import { afterAll, beforeAll, expect, test } from 'bun:test'
import { account, createProject, harness, request, origin, type Account } from './helpers'
import { digest } from '../src/security/tokens'
const h = harness()
let user: Account
beforeAll(async () => {
  user = await account(h.app)
})
afterAll(async () => {
  h.limits.close()
  await h.db.close()
})
test('session cookies are opaque and only hashes persist; CSRF and untrusted origins fail closed', async () => {
  const raw = user.cookie.split('=')[1],
    [session] = await h.db`SELECT token_hash FROM sessions WHERE user_id=${user.id}`
  expect(session.token_hash).toBe(digest(raw))
  expect(session.token_hash).not.toBe(raw)
  expect((await request(h.app, user, '/projects', 'POST', {}, { 'X-CSRF-Token': 'wrong' })).status).toBe(403)
  expect(
    (await request(h.app, user, '/projects', 'POST', {}, { Origin: 'https://evil.example' })).status,
  ).toBe(403)
  const response = await h.app.request('/api/v1/users/me')
  expect(response.status).toBe(401)
  expect((await response.json()).error.requestId).toBeDefined()
})
test('expired and revoked sessions stop authorizing reads', async () => {
  const temporary = await account(h.app)
  await h.db`UPDATE sessions SET idle_expires_at=now()-interval '1 second' WHERE user_id=${temporary.id}`
  expect((await request(h.app, temporary, '/users/me')).status).toBe(401)
  const second = await account(h.app)
  expect((await request(h.app, second, '/auth/logout-all', 'POST')).status).toBe(204)
  expect((await request(h.app, second, '/users/me')).status).toBe(401)
})
test('public links are scoped, reveal no sources and are immediately revocable', async () => {
  const project = await createProject(h.app, user),
    path = `/projects/${project.id}`
  const share = await (await request(h.app, user, `${path}/shares`, 'POST', { scope: 'VIEW' })).json()
  const response = await h.app.request(`/api/v1/public/shares/${share.token}`)
  expect(response.status).toBe(200)
  expect((await response.json()).document.sources).toEqual([])
  const denied = await h.app.request(`/api/v1/public/shares/${share.token}/comments`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ author: 'Guest', text: 'Review', anchor: {} }),
  })
  expect(denied.status).toBe(403)
  expect((await request(h.app, user, `${path}/shares/${share.id}`, 'DELETE')).status).toBe(204)
  expect((await h.app.request(`/api/v1/public/shares/${share.token}`)).status).toBe(404)
})
test('comments, issue assignment and approvals cannot reference another project', async () => {
  const project = await createProject(h.app, user),
    other = await createProject(h.app, user),
    path = `/projects/${project.id}`
  expect(
    (
      await request(h.app, user, `${path}/comments`, 'POST', {
        text: 'Wrong target',
        anchor: { levelId: other.buildings[0].levels[0].id },
      })
    ).status,
  ).toBe(422)
  const comment = await request(h.app, user, `${path}/comments`, 'POST', {
    text: 'Check wall',
    anchor: { entityId: project.buildings[0].levels[0].walls[0].id },
  })
  expect(comment.status).toBe(201)
  const issue = await (
    await request(h.app, user, `${path}/issues`, 'POST', {
      title: 'Review',
      description: 'Door fit',
      anchor: {},
    })
  ).json()
  expect(
    (await request(h.app, user, `${path}/issues/${issue.id}`, 'PATCH', { status: 'CLOSED' })).status,
  ).toBe(409)
  const version = await (
    await request(h.app, user, `/projects/${other.id}/versions`, 'POST', { name: 'Other' })
  ).json()
  expect(
    (
      await request(h.app, user, `${path}/approvals`, 'POST', {
        versionId: version.id,
        decision: 'APPROVED',
        note: '',
      })
    ).status,
  ).toBe(422)
})
test('audit events cannot be edited and server errors never expose SQL or credentials', async () => {
  const project = await createProject(h.app, user)
  await expect(
    (async () => {
      await h.db`UPDATE audit_events SET event='tampered' WHERE project_id=${project.id}`
    })(),
  ).rejects.toThrow()
  const invalid = await request(h.app, user, `/projects/${project.id}/operations`, 'POST', {
    malicious: 'anything',
  })
  expect(invalid.status).toBe(422)
  const text = await invalid.text()
  expect(text).not.toContain('postgres://')
  expect(text).not.toContain('SELECT')
  expect(text).not.toContain('password_hash')
})
test('approval history records the reviewed revision and guest author without impersonation', async () => {
  const project = await createProject(h.app, user),
    path = `/projects/${project.id}`
  const version = await (
    await request(h.app, user, `${path}/versions`, 'POST', { name: 'Reviewed state' })
  ).json()
  const changed = await request(h.app, user, `${path}/operations`, 'POST', {
    operationId: crypto.randomUUID(),
    baseRevision: 0,
    type: 'document.patch',
    entityId: project.id,
    payload: { changes: [{ action: 'put', path: ['name'], value: 'Next state' }] },
  })
  expect(changed.status).toBe(200)
  const approval = await (
    await request(h.app, user, `${path}/approvals`, 'POST', {
      versionId: version.id,
      decision: 'APPROVED',
      note: '',
    })
  ).json()
  expect(Number(approval.project_revision)).toBe(0)
  const levelId = project.buildings[0].levels[0].id
  expect(
    (
      await request(h.app, user, `${path}/approvals`, 'POST', {
        levelId,
        baseRevision: 0,
        decision: 'APPROVED',
        note: '',
      })
    ).status,
  ).toBe(409)
  const live = await request(h.app, user, `${path}/approvals`, 'POST', {
    levelId,
    baseRevision: 1,
    decision: 'APPROVED',
    note: '',
  })
  expect(live.status).toBe(201)
  expect(Number((await live.json()).project_revision)).toBe(1)
  const share = await (
    await request(h.app, user, `${path}/shares`, 'POST', { scope: 'APPROVE', versionId: version.id })
  ).json()
  const guest = await h.app.request(`/api/v1/public/shares/${share.token}/approvals`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ author: 'Client review', decision: 'APPROVED', note: 'Reviewed version' }),
  })
  expect(guest.status).toBe(201)
  const { id } = await guest.json(),
    [row] = await h.db`SELECT * FROM approvals WHERE id=${id}`
  expect(row.actor_id).toBeNull()
  expect(row.share_id).toBe(share.id)
  expect(Number(row.project_revision)).toBe(0)
  await expect(
    (async () => {
      await h.db`UPDATE approvals SET note='tampered' WHERE id=${id}`
    })(),
  ).rejects.toThrow()
})
test('OpenAPI derives request contracts and recursive references from the active routes', async () => {
  const response = await request(h.app, user, '/openapi.json')
  expect(response.status).toBe(200)
  const schema = await response.json()
  expect(schema.paths['/api/v1/projects/{projectId}/operations'].post).toBeDefined()
  expect(
    schema.paths['/api/v1/public/shares/{token}/comments'].post.requestBody.content['application/json'].schema
      .$ref,
  ).toEndWith('/GuestComment')
  expect(schema.components.schemas.Operation).toBeDefined()
  expect(JSON.stringify(schema.components.schemas.Operation)).not.toContain('"$ref":"#/$defs/')
})
