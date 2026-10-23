import { afterAll, expect, test } from 'bun:test'
import { account, createProject, harness, request } from './helpers'
import { readConfig } from '../src/config/env'
import { createServices } from '../src/config/services'
import { createApp } from '../src/app'
const service = harness()
afterAll(async () => {
  service.limits.close()
  await service.db.close()
})
test('snapshot advertises effective permissions and source links stay private', async () => {
  const owner = await account(service.app),
    viewer = await account(service.app),
    stranger = await account(service.app)
  const project = await createProject(service.app, owner)
  await request(service.app, owner, `/projects/${project.id}/members/${viewer.id}`, 'PUT', { role: 'VIEWER' })
  const own = await (await request(service.app, owner, `/projects/${project.id}`)).json()
  const view = await (await request(service.app, viewer, `/projects/${project.id}`)).json()
  expect(own.role).toBe('OWNER')
  expect(view.role).toBe('VIEWER')
  expect(view.document).toEqual(own.document)
  expect((await request(service.app, viewer, `/projects/${project.id}/sources`)).status).toBe(200)
  expect((await request(service.app, stranger, `/projects/${project.id}/sources`)).status).toBe(404)
})
test('deployment can close public registration while keeping authenticated API available', async () => {
  const config = readConfig({
    NODE_ENV: 'test',
    DATABASE_URL: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
    PUBLIC_REGISTRATION: 'false',
  })
  const services = createServices(config),
    app = createApp(services)
  try {
    const response = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { Origin: 'http://127.0.0.1:5173', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Closed', email: 'closed@example.test', password: 'a-long-password-123' }),
    })
    expect(response.status).toBe(403)
    expect((await response.json()).error.code).toBe('REGISTRATION_DISABLED')
  } finally {
    services.limits.close()
    await services.db.close()
  }
})
