import { afterAll, expect, test } from 'bun:test'
import sharp from 'sharp'
import { account, createProject, fixture, harness, MemoryStore, request } from './helpers'
import { claim, complete } from '../src/jobs/queue'
import { analyze } from '../src/workers/analyze'
import { bytesHash } from '../src/modules/assets/validation'
import type { Candidate, Intelligence } from '../src/contracts/analysis'
import type { IntelligenceInput } from '../src/modules/ai/provider'

const store = new MemoryStore(),
  h = harness({ store, ai: true })
afterAll(async () => {
  h.limits.close()
  await h.db.close()
})
test('a separately configured bounded repair records its actual model and invalidates interpretation caches', async () => {
  h.config.GEMINI_MODEL_REPAIR = 'gemini-4-argon'
  const user = await account(h.app),
    project = fixture(),
    level = project.buildings[0].levels[0]
  const sourceId = crypto.randomUUID(),
    assetId = crypto.randomUUID()
  const bytes = await sharp({ create: { width: 300, height: 300, channels: 3, background: 'white' } })
    .png()
    .toBuffer()
  const calibration = {
    a: { x: 0, z: 0 },
    b: { x: 300, z: 0 },
    knownMetres: 12,
    metresPerPixel: 0.04,
    method: 'auto' as const,
  }
  level.sourceId = sourceId
  level.calibration = calibration
  project.sources = [
    {
      id: sourceId,
      name: 'Synthetic repair test',
      mime: 'image/png',
      originalBytes: bytes.length,
      width: 300,
      height: 300,
    },
  ]
  await createProject(h.app, user, project)
  const key = `private/${project.id}/${assetId}`
  await store.write(key, bytes)
  await h.db`INSERT INTO assets(id,project_id,actor_id,object_key,name,mime,size,kind,state,sha256,metadata)
    VALUES (${assetId},${project.id},${user.id},${key},'Synthetic plan','image/png',${bytes.length},'source','ready',${bytesHash(bytes)},${{ width: 300, height: 300, orientation: 1 }}::jsonb)`
  const input = {
    sourceAssetId: assetId,
    sourceId,
    levelId: level.id,
    calibration,
    deterministicCandidates: [],
    options: { mode: 'full', engine: 'backend', purpose: 'rebuild', strategy: 'direct', cloudConsent: true },
  }
  const response = await request(h.app, user, `/projects/${project.id}/analysis`, 'POST', input)
  expect(response.status).toBe(202)
  const { analysisId } = await response.json(),
    job = await claim(h.db, 'repair-model-test', 120, analysisId)
  expect(job).toBeDefined()
  const ring = [
    { x: 0.1, y: 0.1 },
    { x: 0.9, y: 0.1 },
    { x: 0.9, y: 0.9 },
    { x: 0.1, y: 0.9 },
  ]
  const base = { confidence: 0.95, evidence: 'Source outline', needsReview: true as const, uncertainties: [] }
  const door: Candidate = {
    ...base,
    id: 'door',
    kind: 'door',
    wallId: 'wall0',
    points: [
      { x: 0.4, y: 0.4 },
      { x: 0.5, y: 0.5 },
    ],
  }
  const initial: Intelligence = {
    coordinatesVersion: 1,
    coordinateSystem: 'normalized-image-top-left',
    warnings: [],
    candidates: [
      ...ring.map((point, i): Candidate => ({
        ...base,
        id: `wall${i}`,
        kind: 'wall',
        points: [point, ring[(i + 1) % 4]],
        thickness: 0.012,
      })),
      door,
    ],
    understanding: {
      buildingType: 'house',
      footprint: ring,
      conventions: [],
      circulation: [],
      uncertainties: [],
      scale: { a: ring[0], b: ring[1], knownMetres: 10, origin: 'annotated', evidence: '10 m overall' },
    },
  }
  const seen: IntelligenceInput[] = []
  const provider = {
    async interpret(source: IntelligenceInput) {
      seen.push(source)
      return {
        proposal:
          source.pass === 'reconstruct-model'
            ? initial
            : {
                ...initial,
                candidates: [
                  {
                    ...door,
                    points: [
                      { x: 0.6, y: 0.1 },
                      { x: 0.7, y: 0.1 },
                    ],
                  },
                ],
              },
        usage: { totalTokens: 7 },
      }
    },
  }
  const result = await analyze(h.db, h.config, store, provider, job!, AbortSignal.timeout(15000))
  await complete(h.db, job!, result)
  expect(seen.map((source) => source.model)).toEqual([h.config.GEMINI_MODEL_PLAN, 'gemini-4-argon'])
  expect(seen[1].levelContext?.selected.id).toBe(level.id)
  const calls: { model: string; usage: { totalTokens: number } }[] =
    await h.db`SELECT model,usage FROM ai_calls WHERE analysis_id=${analysisId} ORDER BY id`
  expect(calls.map((call) => call.model).sort()).toEqual(
    [h.config.GEMINI_MODEL_PLAN, 'gemini-4-argon'].sort(),
  )
  expect(calls.every((call) => call.usage.totalTokens === 7)).toBe(true)
  const [analysis] = await h.db`SELECT status,result FROM analyses WHERE id=${analysisId}`
  expect(analysis.status).toBe('ready')
  expect(analysis.result.quality.status).not.toBe('blocked')
  h.config.GEMINI_MODEL_REPAIR = 'gemini-3.8-flash'
  const again = await (await request(h.app, user, `/projects/${project.id}/analysis`, 'POST', input)).json()
  expect(again.analysisId).not.toBe(analysisId)
  await h.db`UPDATE jobs SET status='cancelled' WHERE id=${again.analysisId}`
})
