import { afterAll, beforeAll, expect, test } from 'bun:test'
import { account, harness, request, type Account } from './helpers'
import { projectSchema } from '../src/contracts/project'
import { validateGeometry } from '../src/modules/projects/geometry-validation'
import { documentChanges, type Project } from '../client'
import { detachTypicalFloor } from '../../client/src/domain/typicalFloors'
import { representedStoreys } from '../../client/src/domain/storeys'
const h = harness()
let owner: Account, other: Account
beforeAll(async () => {
  owner = await account(h.app)
  other = await account(h.app)
})
afterAll(async () => {
  h.limits.close()
  await h.db.close()
})
test('backend owns the complete template catalogue; every sample instantiates a valid editable project', async () => {
  expect((await h.app.request('/api/v1/templates')).status).toBe(401)
  const catalogue = await (await request(h.app, owner, '/templates')).json()
  expect(catalogue.items).toHaveLength(8)
  expect(catalogue.items.some((item: { id: string }) => ['stadium', 'table-tennis'].includes(item.id))).toBe(
    false,
  )
  expect(
    (await request(h.app, owner, '/templates/stadium/projects', 'POST', { duplicate: false })).status,
  ).toBe(404)
  for (const template of catalogue.items) {
    const response = await request(h.app, owner, `/templates/${template.id}/projects`, 'POST', {
      duplicate: false,
    })
    expect(response.status).toBe(201)
    const created = await response.json(),
      snapshot = await (await request(h.app, owner, `/projects/${created.projectId}`)).json()
    expect(snapshot.document.id).not.toBe(template.project.id)
    expect(snapshot.document.name).toBe(template.title)
    expect(snapshot.document.buildings).toEqual(template.project.buildings)
    expect(projectSchema.safeParse(snapshot.document).success).toBe(true)
    expect(() => validateGeometry(snapshot.document)).not.toThrow()
    expect((await request(h.app, other, `/projects/${created.projectId}`)).status).toBe(404)
  }
}, 20000) // Eight complete project creations, validation and permission checks.
test('template creation retries are idempotent, copies are separate and clients cannot replace template geometry', async () => {
  const path = '/templates/house/projects',
    headers = { 'Idempotency-Key': crypto.randomUUID() }
  const first = await (await request(h.app, owner, path, 'POST', { duplicate: true }, headers)).json()
  const second = await (await request(h.app, owner, path, 'POST', { duplicate: true }, headers)).json()
  expect(first).toEqual(second)
  const another = await (await request(h.app, owner, path, 'POST', { duplicate: true })).json()
  expect(another.projectId).not.toBe(first.projectId)
  expect((await request(h.app, owner, path, 'POST', { duplicate: false }, headers)).status).toBe(409)
  expect(
    (await request(h.app, owner, path, 'POST', { duplicate: true, document: { name: 'Fake' } })).status,
  ).toBe(422)
  expect(
    (await request(h.app, owner, '/templates/missing/projects', 'POST', { duplicate: false })).status,
  ).toBe(404)
})
test('skyscraper copies persist template edits and a detached tenant floor independently of the catalogue and other copy', async () => {
  const catalogue = await (await request(h.app, owner, '/templates')).json(),
    template = catalogue.items.find((item: { id: string }) => item.id === 'asterion-tower')
  expect(template.preferredView).toBe('model')
  expect(template.previewImage).toBe('/samples/asterion-tower.webp')
  const opened = await (
    await request(h.app, owner, '/templates/asterion-tower/projects', 'POST', { duplicate: false })
  ).json()
  const copied = await (
    await request(h.app, owner, '/templates/asterion-tower/projects', 'POST', { duplicate: true })
  ).json()
  expect(opened.projectId).not.toBe(copied.projectId)
  const snapshot = await (await request(h.app, owner, `/projects/${opened.projectId}`)).json(),
    before = snapshot.document as Project
  const building = before.buildings[0],
    group = building.systems!.systems.find((system) => system.kind === 'typical-floors')!
  const edited = structuredClone(before),
    layout = edited.buildings[0].levels.find((level) => level.id === group.templateLevelId)!
  layout.rooms[0].name = 'Tenant collaboration lobby'
  layout.furniture![0].materialOverrides = { finish: 'timber', color: '#774422' }
  const detached = detachTypicalFloor(edited, building.id, group.id, 10),
    floor = detached.buildings[0].levels.at(-1)!
  floor.rooms[0].name = 'Independent tenant floor'
  const response = await request(h.app, owner, `/projects/${opened.projectId}/operations`, 'POST', {
    operationId: crypto.randomUUID(),
    baseRevision: snapshot.revision,
    type: 'document.patch',
    entityId: building.id,
    payload: { changes: documentChanges(before, detached) },
  })
  expect(response.status).toBe(200)
  const reopened = await (await request(h.app, owner, `/projects/${opened.projectId}`)).json(),
    saved = reopened.document.buildings[0]
  expect(reopened.revision).toBe(1)
  expect(representedStoreys(saved)).toBe(48)
  expect(saved.levels).toHaveLength(8)
  expect(saved.levels.find((level: { id: string }) => level.id === group.templateLevelId).rooms[0].name).toBe(
    'Tenant collaboration lobby',
  )
  expect(saved.levels.find((level: { id: string }) => level.id === floor.id).rooms[0].name).toBe(
    'Independent tenant floor',
  )
  expect(saved.systems.systems.find((system: { id: string }) => system.id === group.id).detached['10']).toBe(
    floor.id,
  )
  const other = await (await request(h.app, owner, `/projects/${copied.projectId}`)).json()
  expect(other.document.buildings).toEqual(template.project.buildings)
  const refreshed = await (await request(h.app, owner, '/templates')).json()
  expect(refreshed.items.find((item: { id: string }) => item.id === 'asterion-tower')).toEqual(template)
}, 20000)
