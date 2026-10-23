import { afterAll, beforeAll, expect, test } from 'bun:test'
import sharp from 'sharp'
import { account, createProject, fixture, harness, MemoryStore, request, type Account } from './helpers'
import { bytesHash } from '../src/modules/assets/validation'
import { loadDocument } from '../src/modules/projects/documents'
import { analyze } from '../src/workers/analyze'
import type { Job } from '../src/jobs/queue'
import type { IntelligenceInput } from '../src/modules/ai/provider'
import { defaultRoof } from '../../client/src/domain/types'
const store = new MemoryStore(),
  h = harness({ store, ai: true })
let owner: Account
beforeAll(async () => {
  owner = await account(h.app)
})
afterAll(async () => {
  h.limits.close()
  await h.db.close()
})
async function proposal(completion = false, removal = false) {
  const project = fixture(),
    level = project.buildings[0].levels[0],
    sourceId = crypto.randomUUID(),
    assetId = crypto.randomUUID()
  const bytes = await sharp({ create: { width: 100, height: 100, channels: 3, background: 'white' } })
    .png()
    .toBuffer()
  const calibration = {
    a: { x: 0, z: 0 },
    b: { x: 100, z: 0 },
    knownMetres: 10,
    metresPerPixel: 0.1,
    method: 'manual' as const,
  }
  level.sourceId = sourceId
  level.calibration = calibration
  project.buildings[0].roof = { ...defaultRoof, shape: 'gable' }
  project.sources = [
    {
      id: sourceId,
      name: 'Synthetic.png',
      mime: 'image/png',
      width: 100,
      height: 100,
      originalBytes: bytes.length,
    },
  ]
  await createProject(h.app, owner, project)
  const key = `private/${project.id}/${assetId}`
  await store.write(key, bytes)
  await h.db`INSERT INTO assets(id,project_id,actor_id,object_key,name,mime,size,kind,state,sha256,metadata)
    VALUES (${assetId},${project.id},${owner.id},${key},'Synthetic','image/png',${bytes.length},'source','ready',${bytesHash(bytes)},${{ width: 100, height: 100, orientation: 1 }}::jsonb)`
  const input = {
    sourceAssetId: assetId,
    sourceId,
    levelId: level.id,
    calibration,
    options: {
      mode: 'structure',
      purpose: 'enhance',
      architectureCompletion: completion,
      cloudConsent: true,
    },
  }
  const started = await request(h.app, owner, `/projects/${project.id}/analysis`, 'POST', input)
  expect(started.status).toBe(202)
  const { analysisId } = await started.json()
  const [job] =
    await h.db`UPDATE jobs SET status='running',attempts=1,lease_owner='enhancement-test',lease_expires_at=now()+interval '60 seconds' WHERE id=${analysisId} RETURNING *`
  const provider = {
    async interpret(input: IntelligenceInput) {
      expect(input.currentModel?.[0].targetId).toBe(level.walls[0].id)
      return {
        proposal: {
          coordinatesVersion: 1 as const,
          coordinateSystem: 'normalized-image-top-left' as const,
          warnings: [],
          dispositions:
            removal && input.pass === 'structure'
              ? [
                  {
                    candidateId: level.walls[0].id,
                    decision: 'reject' as const,
                    reason: 'Source shows a dimension annotation, not a wall',
                  },
                ]
              : [],
          candidates:
            !removal && input.pass === 'structure'
              ? [
                  {
                    id: 'thickness-correction',
                    kind: 'wall' as const,
                    targetId: level.walls[0].id,
                    points: [
                      { x: 0, y: 0 },
                      { x: 0.8, y: 0 },
                    ],
                    thickness: 0.04,
                    confidence: 0.9,
                    evidence: 'Thick stroke measurement',
                    uncertainties: [],
                    needsReview: true as const,
                  },
                ]
              : [],
          designs:
            input.pass === 'architecture-completion'
              ? [
                  {
                    id: 'roof-flat',
                    kind: 'roof' as const,
                    label: 'Flat roof',
                    rationale: 'Explicit alternative over existing footprint',
                    origin: 'inferred' as const,
                    roof: { ...defaultRoof, shape: 'hidden' as const },
                    confidence: 0.7,
                    uncertainties: ['Roof is not specified in plan'],
                    needsReview: true as const,
                  },
                ]
              : [],
        },
      }
    },
  }
  await analyze(h.db, h.config, store, provider, job as Job, new AbortController().signal)
  const [row] = await h.db`SELECT result FROM analyses WHERE id=${analysisId}`
  expect(row.result.proposal.candidates[0].targetId).toBe(level.walls[0].id)
  return { project, level, analysisId }
}
test('existing corrections need explicit confirmed-field approval, update one entity, preserve its roof and retry idempotently', async () => {
  const { project, level, analysisId } = await proposal()
  const body = { operationId: crypto.randomUUID(), baseRevision: 0, candidateIds: ['thickness-correction'] }
  const blocked = await request(h.app, owner, `/analysis/${analysisId}/accept`, 'POST', body)
  expect(blocked.status).toBe(422)
  expect((await blocked.json()).error.code).toBe('CONFIRMED_FIELDS_PROTECTED')
  expect((await loadDocument(h.db, project.id)).revision).toBe(0)
  const approved = { ...body, allowConfirmedIds: ['thickness-correction'] }
  const accepted = await request(h.app, owner, `/analysis/${analysisId}/accept`, 'POST', approved)
  expect(accepted.status).toBe(200)
  const current = await loadDocument(h.db, project.id),
    wall = current.document.buildings[0].levels[0].walls[0]
  expect(wall.id).toBe(level.walls[0].id)
  expect(wall.thickness).toBe(0.4)
  expect(current.document.buildings[0].levels[0].walls).toHaveLength(1)
  expect(current.document.buildings[0].roof).toEqual(project.buildings[0].roof)
  expect((await request(h.app, owner, `/analysis/${analysisId}/accept`, 'POST', approved)).status).toBe(200)
  expect((await loadDocument(h.db, project.id)).revision).toBe(1)
})

test('reviewed removals protect confirmed elements, forbid action tampering and commit one idempotent canonical delete', async () => {
  const { project, level, analysisId } = await proposal(false, true)
  const [row] = await h.db`SELECT result FROM analyses WHERE id=${analysisId}`,
    candidate = row.result.proposal.candidates[0]
  expect(candidate.action).toBe('remove')
  const body = { operationId: crypto.randomUUID(), baseRevision: 0, candidateIds: [candidate.id] }
  const denied = await request(h.app, owner, `/analysis/${analysisId}/accept`, 'POST', body)
  expect(denied.status).toBe(422)
  expect((await denied.json()).error.code).toBe('CONFIRMED_FIELDS_PROTECTED')
  const tampered = await request(h.app, owner, `/analysis/${analysisId}/accept`, 'POST', {
    ...body,
    edits: [{ ...candidate, action: undefined }],
  })
  expect(tampered.status).toBe(422)
  expect((await tampered.json()).error.code).toBe('INVALID_ACTION')
  const approved = { ...body, allowConfirmedIds: [candidate.id] }
  expect((await request(h.app, owner, `/analysis/${analysisId}/accept`, 'POST', approved)).status).toBe(200)
  expect((await request(h.app, owner, `/analysis/${analysisId}/accept`, 'POST', approved)).status).toBe(200)
  const current = await loadDocument(h.db, project.id)
  expect(current.revision).toBe(1)
  expect(current.document.buildings[0].levels[0].walls).toHaveLength(0)
  expect(current.document.buildings[0].levels[0].rooms).toEqual(level.rooms)
  expect(current.document.buildings[0].roof).toEqual(project.buildings[0].roof)
})

test('a changed removal target stays protected even if its latest revision and confirmed-field consent are supplied', async () => {
  const { project, level, analysisId } = await proposal(false, true)
  expect(
    (
      await request(h.app, owner, `/projects/${project.id}/operations`, 'POST', {
        operationId: crypto.randomUUID(),
        baseRevision: 0,
        type: 'document.patch',
        entityId: level.walls[0].id,
        payload: {
          changes: [
            {
              action: 'put',
              path: [
                'buildings',
                project.buildings[0].id,
                'levels',
                level.id,
                'walls',
                level.walls[0].id,
                'height',
              ],
              value: 4,
            },
          ],
        },
      })
    ).status,
  ).toBe(200)
  const response = await request(h.app, owner, `/analysis/${analysisId}/accept`, 'POST', {
    operationId: crypto.randomUUID(),
    baseRevision: 1,
    candidateIds: [level.walls[0].id],
    allowConfirmedIds: [level.walls[0].id],
  })
  expect(response.status).toBe(409)
  expect((await response.json()).error.code).toBe('ENHANCEMENT_STALE')
  expect((await loadDocument(h.db, project.id)).document.buildings[0].levels[0].walls[0].height).toBe(4)
})

test('proposal polling and review do not consume the cloud-generation request allowance', async () => {
  const { level, analysisId } = await proposal(false, true)
  for (let index = 0; index < 20; index++)
    expect((await request(h.app, owner, `/analysis/${analysisId}`)).status).toBe(200)
  expect(
    (
      await request(h.app, owner, `/analysis/${analysisId}/accept`, 'POST', {
        operationId: crypto.randomUUID(),
        baseRevision: 0,
        candidateIds: [level.walls[0].id],
        allowConfirmedIds: [level.walls[0].id],
      })
    ).status,
  ).toBe(200)
})
test('manual changes since analysis cannot be overwritten even with consent and the latest revision', async () => {
  const { project, level, analysisId } = await proposal()
  const edited = await request(h.app, owner, `/projects/${project.id}/operations`, 'POST', {
    operationId: crypto.randomUUID(),
    baseRevision: 0,
    type: 'document.patch',
    entityId: level.walls[0].id,
    payload: {
      changes: [
        {
          action: 'put',
          path: [
            'buildings',
            project.buildings[0].id,
            'levels',
            level.id,
            'walls',
            level.walls[0].id,
            'height',
          ],
          value: 3.5,
        },
      ],
    },
  })
  expect(edited.status).toBe(200)
  const response = await request(h.app, owner, `/analysis/${analysisId}/accept`, 'POST', {
    operationId: crypto.randomUUID(),
    baseRevision: 1,
    candidateIds: ['thickness-correction'],
    allowConfirmedIds: ['thickness-correction'],
  })
  expect(response.status).toBe(409)
  expect((await response.json()).error.code).toBe('ENHANCEMENT_STALE')
  expect((await loadDocument(h.db, project.id)).document.buildings[0].levels[0].walls[0].height).toBe(3.5)
})
test('review cannot retarget a correction and design-only acceptance changes the chosen roof without adding geometry', async () => {
  const { project, level, analysisId } = await proposal(true)
  const [row] = await h.db`SELECT result FROM analyses WHERE id=${analysisId}`
  const response = await request(h.app, owner, `/analysis/${analysisId}/accept`, 'POST', {
    operationId: crypto.randomUUID(),
    baseRevision: 0,
    candidateIds: ['thickness-correction'],
    edits: [{ ...row.result.proposal.candidates[0], targetId: 'other_wall' }],
    allowConfirmedIds: ['thickness-correction'],
  })
  expect(response.status).toBe(422)
  expect((await response.json()).error.code).toBe('INVALID_TARGET')
  expect(
    (
      await request(h.app, owner, `/analysis/${analysisId}/accept`, 'POST', {
        operationId: crypto.randomUUID(),
        baseRevision: 0,
        candidateIds: [],
        designIds: ['roof-flat'],
      })
    ).status,
  ).toBe(200)
  const current = (await loadDocument(h.db, project.id)).document
  expect(current.buildings[0].roof?.shape).toBe('hidden')
  expect(current.buildings[0].levels[0].walls).toEqual(level.walls)
  expect(current.buildings[0].levels[0].slabs || []).toHaveLength(0)
})
