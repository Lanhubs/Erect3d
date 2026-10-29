import { afterAll, expect, test } from 'bun:test'
import { fixture, harness, account, createProject, request } from './helpers'
import { Worker } from '../src/workers/runner'
import type { EditingProvider } from '../src/modules/assistant/provider'
import { buildingDesignFixture } from './building-design-fixture'
import { loadDocument } from '../src/modules/projects/documents'
const prompt =
  'craft for me a 2 storey buiding mansion with amazing furnintures in it and also make the building look like a chinese architecture'
const provider: EditingProvider = {
  async next(_model, history) {
    const context = JSON.parse(history[0].parts![0].text!)
    expect(context.scope.mode).toBe('building')
    expect(context.creation.storeys).toBe(2)
    if (!history.some((h) => h.parts?.some((p) => p.functionCall)))
      return {
        text: '',
        content: {
          role: 'model',
          parts: [
            {
              functionCall: { id: 'whole-building', name: 'design_building', args: buildingDesignFixture() },
            },
          ],
        },
      }
    return {
      text: 'A two-storey Chinese-inspired mansion is ready to review. It would replace this building after Apply. The floors are furnished and joined by stairs.',
      content: {
        role: 'model',
        parts: [{ text: 'A two-storey Chinese-inspired mansion is ready to review.' }],
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
test('the exact brief works with no selected element or upper floor, keeps the saved model private, and applies the complete design', async () => {
  const user = await account(h.app),
    p = fixture(),
    b = p.buildings[0],
    l = b.levels[0]
  const before = structuredClone(p)
  await createProject(h.app, user, p)
  const path = `/projects/${p.id}/assistant`,
    response = await request(h.app, user, `${path}/messages`, 'POST', {
      message: prompt,
      baseRevision: 0,
      scope: { mode: 'selection', buildingId: b.id, levelId: l.id },
    })
  expect(response.status).toBe(202)
  const { runId } = await response.json()
  await worker.runOnce(runId)
  const run = await (await request(h.app, user, `${path}/runs/${runId}`)).json()
  expect(run.status).toBe('ready')
  expect(run.scope.mode).toBe('building')
  expect(run.proposal.document.buildings[0].levels).toHaveLength(2)
  expect(run.proposal.focusLevelId).toBe(l.id)
  expect((await loadDocument(h.db, p.id)).document).toEqual(before)
  expect(
    (
      await request(h.app, user, `${path}/runs/${runId}/apply`, 'POST', {
        baseRevision: 0,
        operationId: crypto.randomUUID(),
      })
    ).status,
  ).toBe(200)
  const saved = (await loadDocument(h.db, p.id)).document.buildings[0]
  expect(saved.levels).toHaveLength(2)
  expect(saved.levels[0].stairs).toHaveLength(1)
  expect(saved.levels.every((level) => level.furniture!.length > 0)).toBe(true)
})
test('an unrelated element edit still requires a valid selection and cannot invoke whole-building creation', async () => {
  const user = await account(h.app),
    p = await createProject(h.app, user),
    b = p.buildings[0]
  const result = await request(h.app, user, `/projects/${p.id}/assistant/messages`, 'POST', {
    message: 'make this building look Chinese',
    baseRevision: 0,
    scope: { mode: 'selection', buildingId: b.id, levelId: b.levels[0].id },
  })
  expect(result.status).toBe(422)
  expect((await result.json()).error.code).toBe('ASSISTANT_SCOPE')
})
