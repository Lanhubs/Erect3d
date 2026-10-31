import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Database } from '../../db/connection'
import type { Config } from '../../config/env'
import type { Job } from '../../jobs/queue'
import type { ObjectStore } from '../../storage/objects'
import { requireStore } from '../../storage/objects'
import { ApiError } from '../../security/errors'
import { newId } from '../../security/tokens'
import { writeDerivedAsset } from '../../workers/output'
import { cadMimeToFormat } from './signature'
import { disposeScratch } from './binary'
import { linkConvertedSource } from './link'
import type { ChildMeta } from './child'

const childScript = fileURLToPath(new URL('./child.ts', import.meta.url))
const pngMagic = [137, 80, 78, 71, 13, 10, 26, 10]

export type CadConvertPayload = { sourceId: string; assetId: string }

async function scratch() {
  const root = await mkdtemp(join(tmpdir(), 'erect3d-cad-'))
  return { root, dispose: () => disposeScratch(root, 'erect3d-cad-') }
}

async function runChild(paths: { request: string; root: string }, timeoutMs: number) {
  const child = Bun.spawn([process.execPath, childScript, paths.request, paths.root], {
    stdout: 'ignore',
    stderr: 'ignore',
  })
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    child.kill()
  }, timeoutMs)
  try {
    const code = await child.exited
    if (timedOut) throw new ApiError(422, 'CAD_TIMEOUT', 'The drawing took too long to convert')
    return code
  } finally {
    clearTimeout(timer)
  }
}

export async function convertCad(db: Database, config: Config, store: ObjectStore | undefined, job: Job) {
  const storage = requireStore(store),
    payload = job.payload as CadConvertPayload,
    limits = {
      maxBytes: config.CAD_MAX_BYTES,
      maxEntities: config.CAD_MAX_ENTITIES,
      timeoutMs: config.CAD_CONVERT_TIMEOUT_MS,
    }
  const [asset] =
    await db`SELECT * FROM assets WHERE id=${payload.assetId} AND project_id=${job.project_id} AND state='ready'`
  if (!asset || asset.kind !== 'source')
    throw new ApiError(422, 'INVALID_ASSET', 'CAD import needs a source asset')
  const format = cadMimeToFormat(asset.mime)
  if (!format) throw new ApiError(422, 'INVALID_ASSET', 'Only DWG and DXF drawings can be converted')
  const bytes = await storage.read(asset.object_key, limits.maxBytes)
  const work = await scratch()
  try {
    const input = join(work.root, `drawing.${format}`),
      request = join(work.root, 'request.json')
    await writeFile(input, bytes, { mode: 0o600 })
    await writeFile(
      request,
      JSON.stringify({
        inputPath: input,
        format,
        outDir: work.root,
        converterPath: config.DWG_CONVERTER_PATH,
        limits,
      }),
    )
    await runChild({ request, root: work.root }, limits.timeoutMs + 30000)
    const meta = (await readFile(join(work.root, 'meta.json'), 'utf8')
      .then((text) => JSON.parse(text) as ChildMeta)
      .catch(() => null)) || {
      ok: false as const,
      code: 'DXF_PARSE_FAILED',
      message: 'The CAD converter stopped without a result',
    }
    if (!meta.ok) throw new ApiError(422, meta.code, meta.message)
    const png = await readFile(join(work.root, 'raster.png')).catch(() => null)
    if (!png || !pngMagic.every((value, index) => png[index] === value))
      throw new ApiError(422, 'RASTER_FAILED', 'The drawing did not produce a readable image')
    const rasterAssetId = newId('asset')
    await writeDerivedAsset(db, storage, job, rasterAssetId, {
      bytes: new Uint8Array(png),
      name: `${basename(asset.name, `.${format}`)}.png`,
      mime: 'image/png',
      kind: 'raster',
      parentId: asset.id,
      metadata: {
        width: meta.width,
        height: meta.height,
        orientation: 1,
        source: 'cad',
        units: meta.units,
        entityCount: meta.entityCount,
      },
    })
    await db.begin((tx) =>
      linkConvertedSource(tx, job, {
        sourceId: payload.sourceId,
        originalAssetId: asset.id,
        rasterAssetId,
        width: meta.width,
        height: meta.height,
      }),
    )
    return {
      sourceId: payload.sourceId,
      originalAssetId: asset.id,
      rasterAssetId,
      width: meta.width,
      height: meta.height,
      units: meta.units,
      metresPerPixel: meta.metresPerPixel,
      warnings: meta.warnings,
    }
  } finally {
    await work.dispose()
  }
}
