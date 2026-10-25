import { afterAll, expect, test } from 'bun:test'
import { account, createProject, harness, request } from './helpers'

const h = harness()
afterAll(async () => {
  h.limits.close()
  await h.db.close()
})

test('project owners add registered collaborators by email without exposing an account directory', async () => {
  const owner = await account(h.app),
    member = await account(h.app),
    foreign = await account(h.app)
  const project = await createProject(h.app, owner),
    path = `/projects/${project.id}`
  const [recipient] = await h.db`SELECT email FROM users WHERE id=${member.id}`
  const [ownerAccount] = await h.db`SELECT email FROM users WHERE id=${owner.id}`
  expect(
    (await request(h.app, foreign, `${path}/members`, 'POST', { email: recipient.email, role: 'EDITOR' }))
      .status,
  ).toBe(404)
  expect(
    (
      await request(h.app, foreign, `${path}/members`, 'POST', {
        email: 'missing@example.test',
        role: 'EDITOR',
      })
    ).status,
  ).toBe(404)
  expect(
    (await request(h.app, owner, `${path}/members`, 'POST', { email: 'not-an-email', role: 'EDITOR' }))
      .status,
  ).toBe(422)
  expect(
    (await request(h.app, owner, `${path}/members`, 'POST', { email: ownerAccount.email, role: 'VIEWER' }))
      .status,
  ).toBe(409)
  const missing = await request(h.app, owner, `${path}/members`, 'POST', {
    email: 'missing@example.test',
    role: 'EDITOR',
  })
  expect(missing.status).toBe(422)
  expect((await missing.json()).error.code).toBe('ACCOUNT_NOT_FOUND')
  expect(
    (
      await request(h.app, owner, `${path}/members`, 'POST', {
        email: ` ${recipient.email.toUpperCase()} `,
        role: 'EDITOR',
      })
    ).status,
  ).toBe(204)
  expect((await request(h.app, member, path)).status).toBe(200)
  const listed = await (await request(h.app, owner, `${path}/members`)).json()
  expect(listed).toContainEqual({ id: member.id, name: 'Test user', email: recipient.email, role: 'EDITOR' })
  expect(
    (await request(h.app, member, `${path}/members`, 'POST', { email: ownerAccount.email, role: 'VIEWER' }))
      .status,
  ).toBe(403)
  expect(
    (await request(h.app, owner, `${path}/members`, 'POST', { email: recipient.email, role: 'REVIEWER' }))
      .status,
  ).toBe(204)
  const [count] =
    await h.db`SELECT count(*)::int AS n FROM project_members WHERE project_id=${project.id} AND user_id=${member.id}`
  expect(count.n).toBe(1)
  expect((await request(h.app, owner, `${path}/members/${member.id}`, 'DELETE')).status).toBe(204)
  expect((await request(h.app, member, path)).status).toBe(404)
})
