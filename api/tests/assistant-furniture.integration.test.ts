import { afterAll, expect, test } from 'bun:test'
import { account, createProject, fixture, harness, request } from './helpers'
import { Worker } from '../src/workers/runner'
import { ProviderFailure } from '../src/modules/ai/provider'
import { loadDocument } from '../src/modules/projects/documents'
import { duplicateLevel } from '../../client/src/domain/levels'
import type { EditingProvider } from '../src/modules/assistant/provider'

let disconnected = false
const provider: EditingProvider = {
  async next(model, history) {
    expect(model).toBe('gemini-4-argon')
    if (disconnected) throw new ProviderFailure('AI_NETWORK', true)
    const context = JSON.parse(history[0].parts![0].text!)
    expect(context.targetFloor.name).toBe('Second floor')
    expect(context.furnitureCatalog.assetIds).toContain('television-unit')
    if (!history.some((content) => content.parts?.some((part) => part.functionCall))) {
      return {
        text: '',
        content: {
          role: 'model',
          parts: [
            {
              functionCall: {
                name: 'edit_model',
                id: 'furnish',
                args: {
                  commands: ['sofa', 'television-unit', 'coffee-table'].map((type, i) => ({
                    action: 'create',
                    kind: 'furniture',
                    levelId: context.activeLevelId,
                    properties: JSON.stringify({
                      type,
                      assetId: type,
                      roomId: context.targetFloor.rooms[0].id,
                      position: { x: 1 + i * 2, z: 2 },
                      rotation: 0,
                      width: 1.5,
                      depth: 0.6,
                      height: 0.8,
                    }),
                  })),
                },
              },
            },
          ],
        },
      }
    }
    return {
      text: 'This would furnish the second-floor lounge.',
      content: { role: 'model', parts: [{ text: 'This would furnish the second-floor lounge.' }] },
    }
  },
}
const h = harness({ editingProvider: provider })
const worker = new Worker(h.db, h.config, undefined, undefined, h.metrics, provider)
afterAll(async () => {
  worker.stop()
  h.limits.close()
  await h.db.close()
})
function house() {
  const project = fixture(),
    ground = project.buildings[0].levels[0]
  ground.rooms = [
    {
      id: crypto.randomUUID(),
      name: 'Lounge',
      material: 'timber',
      polygon: [
        { x: 0, z: 0 },
        { x: 8, z: 0 },
        { x: 8, z: 8 },
        { x: 0, z: 8 },
      ],
    },
  ]
  project.buildings[0].levels.push(
    duplicateLevel(ground, 'First floor', 3),
    duplicateLevel(ground, 'Second floor', 6),
  )
  return project
}
const prompt = 'add some furnitures like couch, tv and more to second floor'
test('named second floor is furnished, preview remains private and unapplied, Apply saves only that floor', async () => {
  const user = await account(h.app),
    p = await createProject(h.app, user, house())
  const building = p.buildings[0],
    second = building.levels[2]
  const input = {
    message: prompt,
    baseRevision: 0,
    scope: { mode: 'level', buildingId: building.id, levelId: building.levels[0].id },
  }
  const path = `/projects/${p.id}/assistant`
  const response = await request(h.app, user, `${path}/messages`, 'POST', input)
  expect(response.status).toBe(202)
  const { runId } = await response.json()
  await worker.runOnce(runId)
  const run = await (await request(h.app, user, `${path}/runs/${runId}`)).json()
  expect(run.status).toBe('ready')
  expect(run.scope.levelId).toBe(second.id)
  expect((await loadDocument(h.db, p.id)).document).toEqual(p)
  const levels = run.proposal.document.buildings[0].levels
  expect(levels[0].furniture || []).toHaveLength(0)
  expect(levels[1].furniture || []).toHaveLength(0)
  expect(levels[2].furniture.map((item: any) => item.type)).toEqual([
    'sofa',
    'television-unit',
    'coffee-table',
  ])
  const accepted = await request(h.app, user, `${path}/runs/${runId}/apply`, 'POST', {
    operationId: crypto.randomUUID(),
    baseRevision: 0,
  })
  expect(accepted.status).toBe(200)
  expect((await loadDocument(h.db, p.id)).document.buildings[0].levels[2].furniture).toHaveLength(3)
  const [usage] =
    await h.db`SELECT model,count(*)::int AS count FROM ai_usage WHERE job_id=${runId} GROUP BY model`
  expect(usage).toEqual({ model: 'gemini-4-argon', count: 1 })
})
test('connection failure retains its useful diagnostic and a fresh user retry executes', async () => {
  const user = await account(h.app),
    p = await createProject(h.app, user, house()),
    b = p.buildings[0]
  const path = `/projects/${p.id}/assistant`,
    input = {
      message: prompt,
      baseRevision: 0,
      scope: { mode: 'level', buildingId: b.id, levelId: b.levels[0].id },
    }
  const failed = await (await request(h.app, user, `${path}/messages`, 'POST', input)).json()
  disconnected = true
  try {
    await worker.runOnce(failed.runId)
  } finally {
    disconnected = false
  }
  const run = await (await request(h.app, user, `${path}/runs/${failed.runId}`)).json()
  expect(run.status).toBe('failed')
  expect(run.failure_code).toBe('AI_NETWORK')
  expect(run.progress).toContain('connection to Gemini')
  expect(run.proposal).toBeNull()
  expect((await loadDocument(h.db, p.id)).document).toEqual(p)
  const retried = await (await request(h.app, user, `${path}/messages`, 'POST', input)).json()
  expect(retried.runId).not.toBe(failed.runId)
  await worker.runOnce(retried.runId)
  expect((await (await request(h.app, user, `${path}/runs/${retried.runId}`)).json()).status).toBe('ready')
})
test('missing floors clarify without a charged run, and named locked floors remain protected', async () => {
  const user = await account(h.app),
    document = house()
  document.buildings[0].levels[2].locked = true
  const p = await createProject(h.app, user, document),
    b = p.buildings[0]
  const input = {
    message: 'Furnish fourth floor',
    baseRevision: 0,
    scope: { mode: 'level', buildingId: b.id, levelId: b.levels[0].id },
  }
  const path = `/projects/${p.id}/assistant/messages`
  const missing = await request(h.app, user, path, 'POST', input)
  expect(missing.status).toBe(422)
  expect((await missing.json()).error.message).toContain('Which existing floor')
  const locked = await request(h.app, user, path, 'POST', { ...input, message: prompt })
  expect(locked.status).toBe(409)
  expect((await locked.json()).error.code).toBe('LEVEL_LOCKED')
  const [usage] = await h.db`SELECT count(*)::int AS n FROM ai_usage WHERE project_id=${p.id}`
  expect(usage.n).toBe(0)
})
