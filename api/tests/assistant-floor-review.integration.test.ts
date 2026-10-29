import { afterAll, expect, test } from 'bun:test'
import { account, createProject, fixture, harness, request } from './helpers'
import { Worker } from '../src/workers/runner'
import { loadDocument } from '../src/modules/projects/documents'
import type { EditingProvider } from '../src/modules/assistant/provider'
import { assistantStarters } from '../../client/src/cloud/assistantStarters'

const provider: EditingProvider = {
  async next(_model, history) {
    const context = JSON.parse(history[0].parts![0].text!)
    expect(context.floorReview.checked.furniture).toBe(25)
    expect(context.targetFloor.furniture).toHaveLength(20)
    const defect = context.floorReview.issues.find((issue: any) => issue.kind === 'furniture')
    if (!history.some((content) => content.parts?.some((part) => part.functionCall))) {
      expect(defect.entity.id).toBe('misplaced-sofa')
      return {
        text: '',
        content: {
          role: 'model',
          parts: [
            {
              functionCall: {
                id: 'fix-placement',
                name: 'edit_model',
                args: {
                  commands: [
                    {
                      action: 'set',
                      kind: 'furniture',
                      id: defect.id,
                      properties: JSON.stringify({ position: { x: 4, z: 4 } }),
                    },
                  ],
                },
              },
            },
          ],
        },
      }
    }
    return {
      text: 'The floor review found a sofa outside the lounge. The proposed change moves it inside the room.',
      content: {
        role: 'model',
        parts: [
          {
            text: 'The floor review found a sofa outside the lounge. The proposed change moves it inside the room.',
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

for (const starter of ['review', 'improve'] as const)
  test(`${starter} this floor reviews uncapped geometry and creates an applicable correction`, async () => {
    const user = await account(h.app),
      p = fixture(),
      b = p.buildings[0],
      l = b.levels[0]
    l.walls = []
    l.rooms = [
      {
        id: 'lounge',
        name: 'Lounge',
        material: 'timber',
        polygon: [
          { x: 0, z: 0 },
          { x: 10, z: 0 },
          { x: 10, z: 10 },
          { x: 0, z: 10 },
        ],
      },
    ]
    l.furniture = Array.from({ length: 25 }, (_, i) => ({
      id: i === 24 ? 'misplaced-sofa' : `table${i}`,
      type: i === 24 ? ('sofa' as const) : ('coffee-table' as const),
      assetId: i === 24 ? 'sofa' : 'coffee-table',
      levelId: l.id,
      roomId: 'lounge',
      position: { x: i === 24 ? 30 : 2, z: 2 },
      rotation: 0,
      width: 1,
      depth: 1,
      height: 0.8,
    }))
    await createProject(h.app, user, p)
    const path = `/projects/${p.id}/assistant`
    const response = await request(h.app, user, `${path}/messages`, 'POST', {
      message: assistantStarters[starter].message,
      baseRevision: 0,
      scope: { mode: 'level', buildingId: b.id, levelId: l.id },
    })
    expect(response.status).toBe(202)
    const { runId } = await response.json()
    await worker.runOnce(runId)
    const run = await (await request(h.app, user, `${path}/runs/${runId}`)).json()
    expect(run.status).toBe('ready')
    expect(run.proposal.document.buildings[0].levels[0].furniture[24].position).toEqual({ x: 4, z: 4 })
    expect((await loadDocument(h.db, p.id)).document).toEqual(p)
    const applied = await request(h.app, user, `${path}/runs/${runId}/apply`, 'POST', {
      operationId: crypto.randomUUID(),
      baseRevision: 0,
    })
    expect(applied.status).toBe(200)
    expect((await loadDocument(h.db, p.id)).document.buildings[0].levels[0].furniture![24].position).toEqual({
      x: 4,
      z: 4,
    })
  })
