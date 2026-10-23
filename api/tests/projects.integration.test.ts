import { afterAll, beforeAll, expect, test } from 'bun:test'
import { account, createProject, fixture, harness, request, type Account } from './helpers'
import { commitOperation } from '../src/modules/projects/operations'
import { checksum } from '../src/security/tokens'
import { loadDocument } from '../src/modules/projects/documents'
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
test('create is idempotent, permissions block IDOR and role-limited edits', async () => {
  const document = await createProject(h.app, owner),
    path = `/projects/${document.id}`
  expect((await request(h.app, outsider, path)).status).toBe(404)
  expect(
    (await request(h.app, owner, `${path}/members/${outsider.id}`, 'PUT', { role: 'VIEWER' })).status,
  ).toBe(204)
  expect((await request(h.app, outsider, path)).status).toBe(200)
  const operation = {
    operationId: crypto.randomUUID(),
    baseRevision: 0,
    type: 'document.patch',
    entityId: document.id,
    payload: { changes: [{ action: 'put', path: ['name'], value: 'Changed' }] },
  }
  expect((await request(h.app, outsider, `${path}/operations`, 'POST', operation)).status).toBe(403)
  expect((await request(h.app, owner, `${path}/operations`, 'POST', operation)).status).toBe(200)
  expect((await request(h.app, owner, `${path}/operations`, 'POST', operation)).status).toBe(200)
  expect(
    (
      await request(h.app, owner, `${path}/operations`, 'POST', {
        ...operation,
        payload: { changes: [{ action: 'put', path: ['name'], value: 'Other' }] },
      })
    ).status,
  ).toBe(409)
  const saved = await (await request(h.app, owner, path)).json()
  expect(saved.document.name).toBe('Changed')
  expect(saved.revision).toBe(1)
  expect(saved.checksum).toBe(checksum(saved.document))
})
test('concurrent writers cannot lose a revision; invalid transactions never advance state', async () => {
  const project = await createProject(h.app, owner)
  const actor = { id: owner.id, email: 'unused', name: 'Owner', sessionId: 'test' }
  const operations = ['First', 'Second'].map((name) => ({
    operationId: crypto.randomUUID(),
    baseRevision: 0,
    type: 'document.patch' as const,
    entityId: project.id,
    payload: { changes: [{ action: 'put' as const, path: ['name'], value: name }] },
  }))
  const outcomes = await Promise.allSettled(
    operations.map((operation) => commitOperation(h.db, h.config, actor, project.id, operation)),
  )
  expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1)
  expect((await loadDocument(h.db, project.id)).revision).toBe(1)
  const invalid = {
    ...operations[0],
    operationId: crypto.randomUUID(),
    baseRevision: 1,
    payload: { changes: [{ action: 'put' as const, path: ['units'], value: 'yards' }] },
  }
  await expect(commitOperation(h.db, h.config, actor, project.id, invalid)).rejects.toThrow()
  expect((await loadDocument(h.db, project.id)).revision).toBe(1)
})
test('versions are immutable, restore adds history and semantic compare identifies entity changes', async () => {
  const project = await createProject(h.app, owner),
    path = `/projects/${project.id}`
  const version = await (await request(h.app, owner, `${path}/versions`, 'POST', { name: 'Original' })).json()
  const changed = await request(h.app, owner, `${path}/operations`, 'POST', {
    operationId: crypto.randomUUID(),
    baseRevision: 0,
    type: 'document.patch',
    entityId: project.id,
    payload: { changes: [{ action: 'put', path: ['name'], value: 'Edited' }] },
  })
  expect(changed.status).toBe(200)
  const restored = await request(h.app, owner, `${path}/versions/${version.id}/restore`, 'POST', {
    operationId: crypto.randomUUID(),
    baseRevision: 1,
  })
  expect(restored.status).toBe(200)
  const current = await loadDocument(h.db, project.id)
  expect(current.revision).toBe(2)
  expect(current.document.name).toBe(project.name)
  const compared = await (await request(h.app, owner, `${path}/compare?from=0&to=1`)).json()
  expect(compared.modified).toContain(project.id)
  await expect(
    (async () => {
      await h.db`UPDATE versions SET name='tampered' WHERE id=${version.id}`
    })(),
  ).rejects.toThrow()
})
test('soft deletion revokes access and recovery preserves immutable history', async () => {
  const project = await createProject(h.app, owner),
    path = `/projects/${project.id}`
  expect((await request(h.app, owner, path, 'DELETE')).status).toBe(204)
  expect((await request(h.app, owner, path)).status).toBe(404)
  expect((await request(h.app, outsider, `${path}/recover`, 'POST')).status).toBe(404)
  expect((await request(h.app, owner, `${path}/recover`, 'POST')).status).toBe(200)
  expect((await request(h.app, owner, path)).status).toBe(200)
})
test('locked levels require a separate unlock before geometry edits', async () => {
  const project = fixture(),
    building = project.buildings[0],
    level = building.levels[0]
  level.locked = true
  await createProject(h.app, owner, project)
  const path = `/projects/${project.id}/operations`,
    wallPath = ['buildings', building.id, 'levels', level.id, 'walls', level.walls[0].id, 'height']
  const edit = (revision: number, changes: unknown[]) => ({
    operationId: crypto.randomUUID(),
    baseRevision: revision,
    type: 'document.patch',
    entityId: level.id,
    payload: { changes },
  })
  expect(
    (await request(h.app, owner, path, 'POST', edit(0, [{ action: 'put', path: wallPath, value: 4 }])))
      .status,
  ).toBe(409)
  expect((await loadDocument(h.db, project.id)).revision).toBe(0)
  expect(
    (
      await request(
        h.app,
        owner,
        path,
        'POST',
        edit(0, [
          { action: 'put', path: ['buildings', building.id, 'levels', level.id, 'locked'], value: false },
        ]),
      )
    ).status,
  ).toBe(200)
  expect(
    (await request(h.app, owner, path, 'POST', edit(1, [{ action: 'put', path: wallPath, value: 4 }])))
      .status,
  ).toBe(200)
  await expect(
    (async () => {
      await h.db`UPDATE operations SET type='tampered' WHERE project_id=${project.id}`
    })(),
  ).rejects.toThrow()
  await expect(
    (async () => {
      await h.db`DELETE FROM snapshots WHERE project_id=${project.id}`
    })(),
  ).rejects.toThrow()
})
test('replacing a whole floor cannot bypass a collaborator lock on its existing wall', async () => {
  const project = await createProject(h.app, owner),
    building = project.buildings[0],
    level = building.levels[0],
    wall = level.walls[0]
  await h.db`INSERT INTO entity_locks(project_id,entity_id,user_id,connection_id,expires_at) VALUES (${project.id},${wall.id},${outsider.id},'test-collaborator',now()+interval '1 minute')`
  const operation = {
    operationId: crypto.randomUUID(),
    baseRevision: 0,
    type: 'document.patch',
    entityId: level.id,
    payload: {
      changes: [
        {
          action: 'put',
          path: ['buildings', building.id, 'levels', level.id],
          value: { ...level, walls: [{ ...wall, height: 4 }] },
        },
      ],
    },
  }
  const denied = await request(h.app, owner, `/projects/${project.id}/operations`, 'POST', operation)
  expect(denied.status).toBe(409)
  expect((await denied.json()).error.code).toBe('ENTITY_LOCKED')
  expect((await loadDocument(h.db, project.id)).revision).toBe(0)
})
