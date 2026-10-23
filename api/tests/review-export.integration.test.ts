import { afterAll, beforeAll, expect, test } from 'bun:test'
import { account, createProject, harness, MemoryStore, request, type Account } from './helpers'
import { exportProject } from '../src/workers/exports'
import type { Job } from '../src/jobs/queue'

const store = new MemoryStore(),
  h = harness({ store })
let user: Account, foreign: Account
beforeAll(async () => {
  user = await account(h.app)
  foreign = await account(h.app)
})
afterAll(async () => {
  h.limits.close()
  await h.db.close()
})

test('saved presentations validate view ownership and keep referenced views intact', async () => {
  const project = await createProject(h.app, user),
    path = `/projects/${project.id}`,
    level = project.buildings[0].levels[0]
  const view = await (
    await request(h.app, user, `${path}/views`, 'POST', {
      name: 'Entry',
      levelId: level.id,
      position: { x: 10, y: 3, z: 10 },
      target: { x: 4, y: 1, z: 0 },
      projection: 'perspective',
    })
  ).json()
  const version = await (
    await request(h.app, user, `${path}/versions`, 'POST', { name: 'Presentation' })
  ).json()
  const input = { name: 'Client walk', versionId: version.id, viewIds: [view.id], durationSeconds: 60 }
  const presentation = await request(h.app, user, `${path}/presentations`, 'POST', input)
  expect(presentation.status).toBe(201)
  expect((await request(h.app, user, `${path}/views/${view.id}`, 'DELETE')).status).toBe(409)
  expect((await request(h.app, foreign, `${path}/presentations`)).status).toBe(404)
  expect(
    (await request(h.app, user, `${path}/presentations`, 'POST', { ...input, viewIds: ['view_foreign'] }))
      .status,
  ).toBe(422)
})

test('JSON exports use a pinned canonical revision, private output and idempotent queueing', async () => {
  const project = await createProject(h.app, user),
    path = `/projects/${project.id}`,
    key = crypto.randomUUID()
  const response = await request(
    h.app,
    user,
    `${path}/exports`,
    'POST',
    { format: 'project-json', revision: 0 },
    { 'Idempotency-Key': key },
  )
  expect(response.status).toBe(202)
  const { jobId } = await response.json()
  const repeat = await (
    await request(
      h.app,
      user,
      `${path}/exports`,
      'POST',
      { format: 'project-json', revision: 0 },
      { 'Idempotency-Key': key },
    )
  ).json()
  expect(repeat.jobId).toBe(jobId)
  const [job] =
    await h.db`UPDATE jobs SET status='running',attempts=1,lease_owner='export-test',lease_expires_at=now()+interval '60 seconds'
    WHERE id=${jobId} RETURNING *`
  const result = await exportProject(h.db, store, job as Job)
  const [asset] = await h.db`SELECT object_key FROM assets WHERE id=${result.assetId}`
  const exported = JSON.parse(new TextDecoder().decode(await store.read(asset.object_key, 1000000)))
  expect(exported.revision).toBe(0)
  expect(exported.document).toEqual(project)
  expect((await request(h.app, user, `${path}/assets/${result.assetId}/download`)).status).toBe(200)
  expect((await request(h.app, foreign, `${path}/assets/${result.assetId}/download`)).status).toBe(404)
  await h.db`UPDATE jobs SET status='completed',completed_at=now() WHERE id=${jobId}`
})

test('comment issues retain priority and resolution history across reopen', async () => {
  const project = await createProject(h.app, user),
    path = `/projects/${project.id}`
  const comment = await (
    await request(h.app, user, `${path}/comments`, 'POST', { text: 'Door review', anchor: {} })
  ).json()
  const created = await request(h.app, user, `${path}/issues`, 'POST', {
    title: 'Check clearance',
    description: 'Review entry',
    anchor: {},
    priority: 'HIGH',
    commentId: comment.id,
  })
  expect(created.status).toBe(201)
  const issue = await created.json()
  expect(issue.comment_id).toBe(comment.id)
  expect(issue.priority).toBe('HIGH')
  const resolved = await (
    await request(h.app, user, `${path}/issues/${issue.id}`, 'PATCH', { status: 'RESOLVED' })
  ).json()
  expect(resolved.resolved_at).not.toBeNull()
  const reopened = await (
    await request(h.app, user, `${path}/issues/${issue.id}`, 'PATCH', { status: 'IN_PROGRESS' })
  ).json()
  expect(reopened.resolved_at).toBeNull()
  expect(reopened.priority).toBe('HIGH')
})
