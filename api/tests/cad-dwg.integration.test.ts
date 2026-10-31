import { afterAll, beforeAll, expect, test } from 'bun:test'
import sharp from 'sharp'
import { account, createProject, harness, MemoryStore, request, type Account } from './helpers'
import { fakeDwgConverter, uploadCad } from './cad-import-fixtures'
import { dxfPlanFixture } from './dxf-fixture'
import { claim, enqueue } from '../src/jobs/queue'
import { convertCad } from '../src/modules/cad/convert'

const store = new MemoryStore(),
  h = harness({ store })
let owner: Account,
  projectId = '',
  dxfAssetId = '',
  dwgAssetId = ''
const drawing = () => new TextEncoder().encode('AC1027\n' + 'erect3d test drawing\n'.repeat(40))
const actor = () => ({ id: owner.id, email: 'unused', name: 'Owner', sessionId: 'unused' })

beforeAll(async () => {
  await h.db`UPDATE jobs SET status='cancelled',completed_at=now() WHERE status IN ('queued','running')`
  owner = await account(h.app)
  const project = await createProject(h.app, owner)
  dxfAssetId = (await uploadCad(h, owner, project.id, dxfPlanFixture, 'image/vnd.dxf')).data.assetId
  const dwg = await uploadCad(h, owner, project.id, drawing(), 'image/vnd.dwg')
  expect(dwg.status).toBe(201)
  expect(dwg.data.metadata.format).toBe('dwg-original')
  dwgAssetId = dwg.data.assetId
  projectId = project.id
})
afterAll(async () => {
  h.limits.close()
  await h.db.close()
})

test('a DWG without an installed converter is refused before any worker is queued', async () => {
  const refused = await request(h.app, owner, `/projects/${projectId}/cad/convert`, 'POST', {
    sourceId: 'source_' + crypto.randomUUID(),
    assetId: dwgAssetId,
  })
  expect(refused.status).toBe(503)
  expect((await refused.json()).error.code).toBe('DWG_CONVERTER_UNAVAILABLE')
  const queued =
    await h.db`SELECT count(*)::int AS count FROM jobs WHERE kind='cad.convert' AND project_id=${projectId}`
  expect(queued[0].count).toBe(0)
  const linked = await request(h.app, owner, `/projects/${projectId}/cad/convert`, 'POST', {
    sourceId: 'source_' + crypto.randomUUID(),
    assetId: dxfAssetId,
  })
  expect(linked.status).toBe(202)
})

test('an operator converter turns the same DWG into the raster the analysis expects', async () => {
  const converter = await fakeDwgConverter(dxfPlanFixture)
  try {
    const sourceId = 'source_' + crypto.randomUUID(),
      id = await enqueue(
        h.db,
        actor(),
        projectId,
        'cad.convert',
        { sourceId, assetId: dwgAssetId },
        crypto.randomUUID(),
        0,
        1,
      ),
      job = await claim(h.db, 'dwg-worker', 120, id)
    const result = await convertCad(
      h.db,
      { ...h.config, DWG_CONVERTER_PATH: converter.executable },
      store,
      job!,
    )
    expect([result.sourceId, result.units, result.width]).toEqual([sourceId, 'mm', 3000])
    expect(result.metresPerPixel).toBeCloseTo(0.00203, 5)
    const [link] =
      await h.db`SELECT original_asset_id,raster_asset_id FROM source_plans WHERE project_id=${projectId} AND source_id=${sourceId}`
    expect(link.original_asset_id).toBe(dwgAssetId)
    const [raster] = await h.db`SELECT mime,object_key FROM assets WHERE id=${link.raster_asset_id}`
    expect(raster.mime).toBe('image/png')
    expect((await sharp(await store.read(raster.object_key, 10_000_000)).metadata()).width).toBe(3000)
  } finally {
    await converter.dispose()
  }
}, 120000)

test('a converter that cannot read the drawing reports a code instead of a broken raster', async () => {
  const converter = await fakeDwgConverter(dxfPlanFixture, 'AC1036')
  try {
    const id = await enqueue(
        h.db,
        actor(),
        projectId,
        'cad.convert',
        { sourceId: 'source_' + crypto.randomUUID(), assetId: dwgAssetId },
        crypto.randomUUID(),
        0,
        1,
      ),
      job = await claim(h.db, 'dwg-failing', 120, id)
    await expect(
      convertCad(h.db, { ...h.config, DWG_CONVERTER_PATH: converter.executable }, store, job!),
    ).rejects.toMatchObject({ code: 'DWG_CONVERT_FAILED' })
    const rows = await h.db`SELECT count(*)::int AS count FROM source_plans WHERE project_id=${projectId}`
    expect(rows[0].count).toBe(1)
  } finally {
    await converter.dispose()
  }
}, 120000)
