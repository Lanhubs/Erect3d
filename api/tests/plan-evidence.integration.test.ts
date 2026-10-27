import { afterAll, expect, test } from 'bun:test'
import sharp from 'sharp'
import { account, createProject, fixture, harness, MemoryStore, request } from './helpers'
import { claim } from '../src/jobs/queue'
import { bytesHash } from '../src/modules/assets/validation'
import { readPlanEvidence, withPlanContext } from '../src/workers/plan-evidence'
const h = harness({ store: new MemoryStore(), ai: true })
afterAll(async () => {
  h.limits.close()
  await h.db.close()
})
test('private local label evidence is cached once, survives resume/repair and cannot be replaced by provider-invented OCR', async () => {
  const user = await account(h.app),
    project = fixture(),
    level = project.buildings[0].levels[0]
  const bytes = new Uint8Array(
    await sharp(
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="700" height="300"><rect width="700" height="300" fill="white"/><text x="120" y="160" font-size="40" font-family="sans-serif" fill="black">OBSERVATORY</text></svg>',
      ),
    )
      .png()
      .toBuffer(),
  )
  const assetId = crypto.randomUUID(),
    sourceId = crypto.randomUUID()
  level.sourceId = sourceId
  const calibration = {
    a: { x: 0, z: 0 },
    b: { x: 700, z: 0 },
    knownMetres: 20,
    metresPerPixel: 20 / 700,
    method: 'auto' as const,
  }
  level.calibration = calibration
  project.sources = [
    {
      id: sourceId,
      name: 'Synthetic label test',
      mime: 'image/png',
      originalBytes: bytes.length,
      width: 700,
      height: 300,
    },
  ]
  await createProject(h.app, user, project)
  await h.db`INSERT INTO assets(id,project_id,actor_id,object_key,name,mime,size,kind,state,sha256,metadata) VALUES (${assetId},${project.id},${user.id},${`private/${project.id}/${assetId}`},'Synthetic label test','image/png',${bytes.length},'source','ready',${bytesHash(bytes)},${{ width: 700, height: 300, orientation: 1 }}::jsonb)`
  const response = await request(h.app, user, `/projects/${project.id}/analysis`, 'POST', {
    sourceAssetId: assetId,
    sourceId,
    levelId: level.id,
    calibration,
    deterministicCandidates: [],
    options: { mode: 'full', engine: 'backend', purpose: 'rebuild', strategy: 'direct', cloudConsent: true },
  })
  expect(response.status).toBe(202)
  const { analysisId } = await response.json(),
    job = await claim(h.db, 'local-text-test', 120, analysisId)
  expect(job).toBeDefined()
  const first = await readPlanEvidence(true, bytes, undefined, h.db, job!, [], AbortSignal.timeout(20000))
  expect(first?.sourceText.items.some((item) => item.text.includes('OBSERVATORY'))).toBe(true)
  const resumed = await readPlanEvidence(true, bytes, undefined, h.db, job!, [], AbortSignal.timeout(20000))
  expect(resumed?.sourceText).toEqual(first?.sourceText)
  expect(await h.db`SELECT pass FROM analysis_passes WHERE analysis_id=${analysisId}`).toHaveLength(1)
  expect(await h.db`SELECT id FROM ai_calls WHERE analysis_id=${analysisId}`).toHaveLength(0)
  const provider = withPlanContext(
    {
      async interpret(input) {
        expect(input.bytes).toBe(bytes)
        expect(input.sourceText).toEqual(first?.sourceText)
        return {
          proposal: {
            coordinatesVersion: 1,
            coordinateSystem: 'normalized-image-top-left',
            candidates: [],
            warnings: [],
            sourceText: { version: 1, engine: 'tesseract-local', status: 'ready', items: [], warnings: [] },
          },
        }
      },
    },
    project,
    level.id,
    first?.sourceText,
  )
  const result = await provider.interpret(
    {
      bytes,
      mime: 'image/png',
      width: 700,
      height: 300,
      candidates: [],
      model: 'fake',
      pass: 'validated-model-repair',
    },
    AbortSignal.timeout(2000),
  )
  expect(result.proposal.sourceText).toEqual(first?.sourceText)
  const foreign = await account(h.app)
  expect((await request(h.app, foreign, `/analysis/${analysisId}`)).status).toBe(404)
  await h.db`UPDATE jobs SET status='cancelled' WHERE id=${analysisId}`
}, 20000)
