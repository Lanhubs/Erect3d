import { afterAll, expect, test } from 'bun:test'
import sharp from 'sharp'
import { account, createProject, fixture, harness, MemoryStore, origin, request } from './helpers'
import { planReference } from '../src/modules/assistant/plan-reference'
import { newId } from '../src/security/tokens'
import type { Account } from './helpers'

const store = new MemoryStore(),
  h = harness({ store })
afterAll(async () => {
  h.limits.close()
  await h.db.close()
})

const asciiDxf =
  '  0\nSECTION\n  2\nENTITIES\n  0\nLINE\n  8\nA-WALL\n 10\n0\n 20\n0\n 11\n800\n 21\n0\n  0\nENDSEC\n  0\nEOF\n'
const pdfBytes = new TextEncoder().encode('%PDF-1.7\n% plan page\n')
const raster = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#ffffff' } })
  .png()
  .toBuffer()

async function upload(
  user: Account,
  projectId: string,
  bytes: Uint8Array,
  name: string,
  kind: string,
  mime: string,
) {
  const response = await h.app.request(
    `/api/v1/projects/${projectId}/assets/optimized-upload?name=${encodeURIComponent(name)}&kind=${kind}&mime=${encodeURIComponent(mime)}`,
    {
      method: 'POST',
      headers: {
        Origin: origin,
        Cookie: user.cookie,
        'X-CSRF-Token': user.csrf,
        'Content-Type': mime,
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: new Uint8Array(bytes),
    },
  )
  expect(response.status).toBe(201)
  return (await response.json()).assetId as string
}

const drawing = {
  id: newId('source'),
  name: 'level 3.dxf',
  mime: 'image/vnd.dxf' as const,
  originalBytes: asciiDxf.length,
  width: 800,
  height: 600,
  units: 'unknown' as const,
}
const scanned = {
  id: newId('source'),
  name: 'issued for construction.pdf',
  mime: 'application/pdf' as const,
  originalBytes: pdfBytes.length,
  width: 800,
  height: 600,
  page: 1,
  pages: 1,
  units: 'm' as const,
}

test('a drawing reaches the assistant as its converted image, a PDF as its own file', async () => {
  const user = await account(h.app),
    project = await createProject(h.app, user, { ...fixture(), sources: [drawing, scanned] }),
    dxfAsset = await upload(
      user,
      project.id,
      new TextEncoder().encode(asciiDxf),
      drawing.name,
      'source',
      drawing.mime,
    ),
    rasterAsset = await upload(user, project.id, raster, 'level 3 raster.png', 'raster', 'image/png'),
    pdfAsset = await upload(user, project.id, pdfBytes, scanned.name, 'source', scanned.mime),
    pageAsset = await upload(user, project.id, raster, 'page 1.png', 'raster', 'image/png')
  for (const [source, original, page] of [
    [drawing, dxfAsset, rasterAsset],
    [scanned, pdfAsset, pageAsset],
  ] as const)
    expect(
      (
        await request(h.app, user, `/projects/${project.id}/sources/${source.id}`, 'PUT', {
          originalAssetId: original,
          rasterAssetId: page,
          ...(source.mime === 'application/pdf' ? { page: source.page } : {}),
        })
      ).status,
    ).toBe(204)
  const reference = await planReference(h.db, store, project.id, drawing.id)
  expect(reference.mime).toBe('image/png')
  expect(Buffer.from(reference.bytes)).toEqual(Buffer.from(raster))
  expect(reference.text).toContain('the image converted from the drawing')
  expect(reference.text).toContain('untrusted source evidence')
  const original = await planReference(h.db, store, project.id, scanned.id)
  expect(original.mime).toBe('application/pdf')
  expect(Buffer.from(original.bytes)).toEqual(Buffer.from(pdfBytes))
  expect(original.text).not.toContain('converted')
})

test('an unlinked or unconverted drawing is refused before the model is billed', async () => {
  const user = await account(h.app),
    project = await createProject(h.app, user, { ...fixture(), sources: [drawing] }),
    missing = await planReference(h.db, store, project.id, drawing.id).catch((error) => error)
  expect(missing.code).toBe('SOURCE_MISSING')
  const asset = await upload(
      user,
      project.id,
      new TextEncoder().encode(asciiDxf),
      drawing.name,
      'source',
      drawing.mime,
    ),
    rasterAsset = await upload(user, project.id, raster, 'level 3 raster.png', 'raster', 'image/png')
  expect(
    (
      await request(h.app, user, `/projects/${project.id}/sources/${drawing.id}`, 'PUT', {
        originalAssetId: asset,
        rasterAssetId: rasterAsset,
      })
    ).status,
  ).toBe(204)
  await h.db`UPDATE source_plans SET raster_asset_id=NULL WHERE project_id=${project.id} AND source_id=${drawing.id}`
  const unconverted = await planReference(h.db, store, project.id, drawing.id).catch((error) => error)
  expect(unconverted.code).toBe('SOURCE_MISSING')
  expect(unconverted.message).toContain('no converted image')
})
