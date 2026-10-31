import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { dwgToDxf } from './dwg'
import { dxfToRaster } from './render'
import { CadFailure, type CadUnit } from './types'
import type { CadFormat } from './signature'

export type ChildRequest = {
  inputPath: string
  format: CadFormat
  outDir: string
  converterPath?: string
  limits: { maxBytes: number; maxEntities: number; timeoutMs: number }
}
export type ChildMeta =
  | {
      ok: true
      units: CadUnit
      metresPerPixel: number | null
      width: number
      height: number
      entityCount: number
      warnings: string[]
    }
  | { ok: false; code: string; message: string }

const read = async (path: string) => new Uint8Array(await readFile(path))

async function drawingText(request: ChildRequest, bytes: Uint8Array) {
  if (request.format === 'dxf') return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  return dwgToDxf(bytes, {
    executable: request.converterPath,
    maxBytes: request.limits.maxBytes,
    timeoutMs: request.limits.timeoutMs,
  })
}

async function run(requestPath: string) {
  const request = (await Bun.file(requestPath).json()) as ChildRequest,
    outDir = request.outDir
  await mkdir(outDir, { recursive: true })
  const bytes = await read(request.inputPath)
  if (!bytes.length || bytes.length > request.limits.maxBytes)
    throw new CadFailure('DXF_TOO_LARGE', 'The drawing is empty or larger than the permitted size')
  const result = await dxfToRaster(await drawingText(request, bytes), request.limits)
  await writeFile(join(outDir, 'raster.png'), result.png)
  const meta: ChildMeta = {
    ok: true,
    units: result.units,
    metresPerPixel: result.metresPerPixel,
    width: result.width,
    height: result.height,
    entityCount: result.entityCount,
    warnings: result.warnings,
  }
  await Bun.write(join(outDir, 'meta.json'), JSON.stringify(meta))
}

const requestPath = process.argv[2]
const scratch = process.argv[3]
if (!requestPath || !scratch) process.exit(2)
run(requestPath).catch(async (error: unknown) => {
  const failure: ChildMeta =
    error instanceof CadFailure
      ? { ok: false, code: error.code, message: error.message }
      : {
          ok: false,
          code: 'DXF_PARSE_FAILED',
          message: (error as Error)?.message || 'CAD conversion crashed',
        }
  await mkdir(scratch, { recursive: true })
  await Bun.write(join(scratch, 'meta.json'), JSON.stringify(failure)).catch(() => process.exit(1))
  process.exit(0)
})
