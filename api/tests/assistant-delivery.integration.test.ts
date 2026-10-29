import { afterAll, expect, test } from 'bun:test'
import { account, createProject, fixture, harness, request } from './helpers'
import { Worker } from '../src/workers/runner'
import { loadDocument } from '../src/modules/projects/documents'
import type { EditingProvider } from '../src/modules/assistant/provider'

const provider: EditingProvider = {
  async next(_model, history) {
    const context = JSON.parse(history[0].parts![0].text!)
    const noEdits = history.some((content) => content.parts?.some((part) => part.text === 'noop'))
    const reminders = history.filter((content) =>
      content.parts?.some((part) => part.text?.includes('No new edit_model')),
    ).length
    const edited = history.some((content) =>
      content.parts?.some((part) => part.functionCall?.name === 'edit_model'),
    )
    if (noEdits || !reminders || edited)
      return {
        text: 'I have prepared a couch and TV proposal. Ready to preview.',
        content: {
          role: 'model',
          parts: [{ text: 'I have prepared a couch and TV proposal. Ready to preview.' }],
        },
      }
    expect(context.selection.element.name).toBe('2-car garage')
    return {
      text: '',
      content: {
        role: 'model',
        parts: [
          {
            functionCall: {
              name: 'edit_model',
              id: 'real-edit',
              args: {
                commands: ['sofa', 'television-unit'].map((type, i) => ({
                  action: 'create',
                  kind: 'furniture',
                  levelId: context.activeLevelId,
                  properties: JSON.stringify({
                    type,
                    assetId: type,
                    roomId: context.selection.element.id,
                    position: { x: 2 + i * 3, z: 2 },
                    rotation: 0,
                    width: 1.8,
                    depth: 0.8,
                    height: 1,
                  }),
                })),
              },
            },
          },
        ],
      },
    }
  },
}
const h = harness({ editingProvider: provider }),
  worker = new Worker(h.db, h.config, undefined, undefined, h.metrics, provider)
afterAll(async () => {
  worker.stop()
  h.limits.close()
  await h.db.close()
})
async function start(message: string) {
  const user = await account(h.app),
    p = fixture(),
    b = p.buildings[0],
    l = b.levels[0]
  l.rooms = [
    {
      id: crypto.randomUUID(),
      name: '2-car garage',
      material: 'concrete',
      polygon: [
        { x: 0, z: 0 },
        { x: 8, z: 0 },
        { x: 8, z: 6 },
        { x: 0, z: 6 },
      ],
    },
  ]
  await createProject(h.app, user, p)
  const path = `/projects/${p.id}/assistant`
  const response = await request(h.app, user, `${path}/messages`, 'POST', {
    message,
    baseRevision: 0,
    scope: { mode: 'selection', buildingId: b.id, levelId: l.id, entityId: l.rooms[0].id },
  })
  expect(response.status).toBe(202)
  const { runId } = await response.json()
  await worker.runOnce(runId)
  const run = await (await request(h.app, user, `${path}/runs/${runId}`)).json()
  return { user, p, path, run, runId }
}
test('text-only readiness cannot fake success; the bounded retry prepares real selected-room changes and Apply saves them', async () => {
  const { user, p, path, run, runId } = await start('add a couch and a tv into this room')
  expect(run.status).toBe('ready')
  expect(run.proposal.document.buildings[0].levels[0].furniture.map((f: any) => f.type)).toEqual([
    'sofa',
    'television-unit',
  ])
  expect((await loadDocument(h.db, p.id)).document).toEqual(p)
  expect(
    (
      await request(h.app, user, `${path}/runs/${runId}/apply`, 'POST', {
        operationId: crypto.randomUUID(),
        baseRevision: 0,
      })
    ).status,
  ).toBe(200)
  expect((await loadDocument(h.db, p.id)).document.buildings[0].levels[0].furniture).toHaveLength(2)
  const [usage] = await h.db`SELECT count(*)::int AS n FROM ai_usage WHERE job_id=${runId}`
  expect(usage.n).toBe(1)
})
test('persistent text-only claims remain unapplied and are never presented as a ready model proposal', async () => {
  const { p, run } = await start('noop')
  expect(run.status).toBe('clarification')
  expect(run.summary).toContain('No model edits were prepared')
  expect(run.proposal).toBeNull()
  expect((await loadDocument(h.db, p.id)).document).toEqual(p)
})
