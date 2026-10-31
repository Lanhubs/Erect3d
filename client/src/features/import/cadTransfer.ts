import { api } from '../../cloud/api'
import { waitForJob } from '../../cloud/jobs'
import { uploadAsset } from '../../cloud/sources'
import type { SourceUnits } from '../../domain/types'
import { cadMimeFor, type CadFormat } from './cadFormat'

export type CadStage = 'uploading' | 'converting' | 'downloading'
export type CadConverted = {
  rasterAssetId: string
  width: number
  height: number
  units: SourceUnits
  metresPerPixel: number | null
  warnings: string[]
}
export type CadTicket =
  { jobId: string } | { jobId: null; rasterAssetId: string; width: number; height: number }

const failureMessages: Record<string, string> = {
  DXF_PARSE_FAILED: 'The drawing could not be read. Re-export it from your CAD tool as ASCII DXF.',
  DXF_EMPTY: 'The drawing has no visible geometry to convert.',
  DXF_TOO_COMPLEX: 'The drawing has too many entities for one floor. Purge or simplify it and try again.',
  DXF_TOO_LARGE: 'The drawing is bigger than the permitted CAD size.',
  DWG_CONVERT_FAILED: 'This DWG needs a server-side converter that is not installed. Export it as ASCII DXF.',
  DWG_CONVERTER_UNAVAILABLE:
    'This server has no DWG converter installed. Export the drawing as ASCII DXF and import that instead.',
  RASTER_FAILED: 'The drawing could not be turned into an image.',
  CAD_TIMEOUT: 'The drawing took too long to convert. Export a simpler drawing and try again.',
}

export const cadFailureMessage = (code?: string | null) =>
  (code && failureMessages[code]) || `The drawing conversion failed (${code || 'an unknown reason'}).`

export const uploadCadOriginal = (projectId: string, file: File, format: CadFormat) =>
  uploadAsset(projectId, file, file.name, 'source', cadMimeFor(format), crypto.randomUUID()).then(
    (uploaded) => uploaded.assetId,
  )

export const startCadConversion = (projectId: string, sourceId: string, assetId: string) =>
  api.request<CadTicket>(`/projects/${projectId}/cad/convert`, 'POST', { sourceId, assetId }, sourceId)

/** The worker runs a single attempt, so polling only waits for its terminal state. */
export async function waitForCadConversion(
  projectId: string,
  jobId: string,
  limitMs = 180000,
): Promise<CadConverted> {
  return waitForJob<CadConverted>(projectId, jobId, {
    limitMs,
    failure: (code) => cadFailureMessage(code),
    patience: 'The drawing is still converting. Reload this floor in a moment and import it again.',
  })
}
