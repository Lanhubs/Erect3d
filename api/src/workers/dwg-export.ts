import type { Config } from '../config/env'
import { ApiError } from '../security/errors'
import { cadCapabilities } from '../modules/cad/capabilities'
import { CadFailure } from '../modules/cad/types'
import { dxfToDwg } from '../modules/cad/dwg'

export type CadExportFormat = 'dxf' | 'dwg'

/**
 * DWG stays experimental: LibreDWG writes R2000 and complex entities can degrade,
 * so the sheet is always drawn as DXF first and only then converted.
 */
export async function dwgFromDxf(dxf: Uint8Array, config: Config, format: CadExportFormat) {
  if (format !== 'dwg') return null
  if (!(await cadCapabilities(config)).dwgExport)
    throw new ApiError(
      503,
      'DWG_CONVERTER_UNAVAILABLE',
      'DWG export needs a server-side dxf2dwg converter. Export the drawing as DXF instead.',
    )
  try {
    const bytes = await dxfToDwg(dxf, {
      executable: config.DXF_TO_DWG_CONVERTER_PATH,
      timeoutMs: config.CAD_CONVERT_TIMEOUT_MS,
      maxBytes: config.CAD_MAX_BYTES,
    })
    return { bytes, converter: 'libredwg' }
  } catch (error) {
    if (error instanceof CadFailure) throw new ApiError(422, error.code, error.message)
    throw error
  }
}
