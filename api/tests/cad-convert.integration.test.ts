import { afterAll, beforeAll, expect, test } from 'bun:test'
import sharp from 'sharp'
import { account, createProject, fixture, harness, MemoryStore, request, type Account } from './helpers'
import { uploadCad } from './cad-import-fixtures'
import { dxfPlanFixture } from './dxf-fixture'
import { dxfDocument, entity, section } from './dxf-builder'
import { Worker } from '../src/workers/runner'
import { maintenance } from '../src/workers/maintenance'
import { calibrationFromMetresPerPixel } from '../../client/src/geometry/autoScale'
import type { Project } from '../src/contracts/project'

const store = new MemoryStore(),
  h = harness({ store, ai: true, config: { CAD_MAX_BYTES: 1_048_576 } })
let owner: Account,
  plan: Project,
  dxfAssetId = '',
  drawn = { rasterAssetId: '', width: 0, height: 0, metresPerPixel: 0 }
const sourceId = 'source_' + crypto.randomUUID()

beforeAll(async () => {
  await h.db`UPDATE jobs SET status='cancelled',completed_at=now() WHERE status IN ('queued','running')`
  owner = await account(h.app)
  plan = fixture()
})
afterAll(async () => {
  h.limits.close()
  await h.db.close()
})

test('a DXF source uploads and converts once into a linkable upright raster', async () => {
  await createProject(h.app, owner, plan)
  const uploaded = await uploadCad(h, owner, plan.id, dxfPlanFixture, 'image/vnd.dxf')
  expect(uploaded.status).toBe(201)
  expect(uploaded.data.metadata).toMatchObject({ format: 'dxf-original', signatureValidated: true })
  dxfAssetId = uploaded.data.assetId
  const pending = await h.db`SELECT count(*)::int AS count FROM jobs WHERE project_id=${plan.id}`
  expect(pending[0].count).toBe(0)
  const convert = await request(h.app, owner, `/projects/${plan.id}/cad/convert`, 'POST', {
    sourceId,
    assetId: dxfAssetId,
  })
  expect(convert.status).toBe(202)
  const { jobId, format } = await convert.json()
  expect(format).toBe('dxf')
  expect(await new Worker(h.db, h.config, store, undefined, h.metrics).runOnce(jobId)).toBe(true)
  const job = await (await request(h.app, owner, `/projects/${plan.id}/jobs/${jobId}`)).json()
  expect([job.status, job.failure_code]).toEqual(['completed', null])
  expect(job.result).toMatchObject({ sourceId, originalAssetId: dxfAssetId, units: 'mm', warnings: [] })
  expect(job.result.width).toBe(3000)
  expect(job.result.metresPerPixel).toBeCloseTo(0.00203, 5)
  drawn = job.result
  const [raster] =
    await h.db`SELECT name,mime,kind,parent_id,metadata FROM assets WHERE id=${drawn.rasterAssetId}`
  expect([raster.name, raster.mime, raster.kind, raster.parent_id]).toEqual([
    'Plan.png',
    'image/png',
    'raster',
    dxfAssetId,
  ])
  expect(raster.metadata).toMatchObject({ source: 'cad', orientation: 1, units: 'mm' })
  const [object] = await h.db`SELECT object_key FROM assets WHERE id=${drawn.rasterAssetId}`
  const png = await store.read(object.object_key, 10_000_000)
  expect((await sharp(Buffer.from(png)).metadata()).width).toBe(drawn.width)
  const objects = store.objects.size
  const repeated = await request(h.app, owner, `/projects/${plan.id}/cad/convert`, 'POST', {
    sourceId,
    assetId: dxfAssetId,
  })
  expect(await repeated.json()).toMatchObject({ jobId: null, rasterAssetId: drawn.rasterAssetId })
  expect(store.objects.size).toBe(objects)
}, 60000)

test('the saved document links the drawing and turns its raster into an analysable source', async () => {
  const level = plan.buildings[0].levels[0],
    path = ['buildings', plan.buildings[0].id, 'levels', level.id],
    calibration = calibrationFromMetresPerPixel(drawn.width, drawn.height, drawn.metresPerPixel)
  const saved = await request(h.app, owner, `/projects/${plan.id}/operations`, 'POST', {
    operationId: 'operation_' + crypto.randomUUID(),
    baseRevision: 0,
    type: 'document.patch',
    entityId: sourceId,
    payload: {
      changes: [
        {
          action: 'put',
          path: ['sources', sourceId],
          value: {
            id: sourceId,
            name: 'Plan.dxf',
            mime: 'image/vnd.dxf',
            originalBytes: dxfPlanFixture.length,
            width: drawn.width,
            height: drawn.height,
            units: 'mm',
            metresPerPixel: drawn.metresPerPixel,
          },
        },
        { action: 'put', path: [...path, 'sourceId'], value: sourceId },
        { action: 'put', path: [...path, 'calibration'], value: calibration },
      ],
    },
  })
  expect(saved.status).toBe(200)
  const linked = await request(h.app, owner, `/projects/${plan.id}/sources/${sourceId}`, 'PUT', {
    originalAssetId: dxfAssetId,
    rasterAssetId: drawn.rasterAssetId,
  })
  expect(linked.status).toBe(204)
  expect(await (await request(h.app, owner, `/projects/${plan.id}/sources`)).json()).toMatchObject([
    { source_id: sourceId, original_asset_id: dxfAssetId, raster_asset_id: drawn.rasterAssetId, page: null },
  ])
  const analysis = await request(h.app, owner, `/projects/${plan.id}/analysis`, 'POST', {
    sourceAssetId: drawn.rasterAssetId,
    sourceId,
    levelId: level.id,
    calibration,
    options: { mode: 'structure', cloudConsent: true },
  })
  expect(analysis.status).toBe(202)
  expect((await analysis.json()).analysisId).toBeString()
  const denied = await request(h.app, owner, `/projects/${plan.id}/analysis`, 'POST', {
    sourceAssetId: dxfAssetId,
    sourceId,
    levelId: level.id,
    calibration,
    options: { mode: 'structure', cloudConsent: true },
  })
  expect(denied.status).toBe(422)
})

test('an oversized drawing and a mislabelled CAD kind never reach storage', async () => {
  const lines = Array.from({ length: 24_000 }, (_line, index) =>
    entity('LINE', [
      [8, 'WALLS'],
      [10, 0],
      [20, index],
      [11, 6000],
      [21, index],
    ]),
  )
  const oversized = dxfDocument([section('ENTITIES', lines.flat())])
  expect(oversized.length).toBeGreaterThan(1_048_576)
  expect((await uploadCad(h, owner, plan.id, oversized, 'image/vnd.dxf')).status).toBe(413)
  expect((await uploadCad(h, owner, plan.id, dxfPlanFixture, 'image/vnd.dxf', 'raster')).status).toBe(422)
  const rows =
    await h.db`SELECT count(*)::int AS raster FROM assets WHERE project_id=${plan.id} AND kind='raster'`
  expect(rows[0].raster).toBe(1)
})

test('a named link survives the daily sweep and an abandoned one is released', async () => {
  const renamed = await request(h.app, owner, `/projects/${plan.id}/operations`, 'POST', {
    operationId: crypto.randomUUID(),
    baseRevision: 1,
    type: 'document.patch',
    entityId: plan.id,
    payload: { changes: [{ action: 'put', path: ['name'], value: 'Imported plan' }] },
  })
  expect(renamed.status).toBe(200)
  const orphan = await createProject(h.app, owner)
  await h.db`INSERT INTO source_plans(project_id,source_id,original_asset_id,width,height)
    VALUES (${orphan.id},'source_abandoned',${dxfAssetId},3000,2016)`
  await h.db`UPDATE source_plans SET created_at = now() - interval '25 hours'`
  await maintenance(h.db)
  expect(await h.db`SELECT 1 FROM source_plans WHERE source_id=${sourceId}`).toHaveLength(1)
  expect(await h.db`SELECT 1 FROM source_plans WHERE source_id='source_abandoned'`).toHaveLength(0)
})
