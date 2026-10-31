import { capabilities } from '../../cloud/api'
import { downloadPrivateAsset } from '../../cloud/sources'
import { cloudPersistence } from '../../state/persistenceMode'
import type { Project, SourceUnits } from '../../domain/types'
import { uid } from '../../domain/types'
import { cadMimeFor, type CadFormat } from './cadFormat'
import type { ScannedSource } from './readSource'
import {
  startCadConversion,
  uploadCadOriginal,
  waitForCadConversion,
  type CadConverted,
  type CadStage,
  type CadTicket,
} from './cadTransfer'

export type CadImport = ScannedSource
export const cloudRequiredMessage =
  'DWG and DXF import uses the cloud converter. Save this project to the cloud first, or export the drawing as PDF or PNG.'

async function requireConverter(format: CadFormat) {
  const ready = await capabilities()
  if (!ready.cadImport) throw new Error('This server has no CAD import support enabled.')
  if (format === 'dwg' && !ready.dwgImport)
    throw new Error(
      'DWG needs a server-side converter that is not installed here. Export the drawing as ASCII DXF instead.',
    )
}

const projectIdOf = (project: Project) => {
  const cloud = cloudPersistence()
  if (!cloud || cloud.projectId !== project.id) throw new Error(cloudRequiredMessage)
  return cloud.projectId
}

// A conversion that already exists for this drawing reports its raster directly.
const reused = (ticket: Exclude<CadTicket, { jobId: string }>): CadConverted => ({
  rasterAssetId: ticket.rasterAssetId,
  width: ticket.width,
  height: ticket.height,
  units: 'unknown' satisfies SourceUnits,
  metresPerPixel: null,
  warnings: [],
})

/** Turns a drawing into the upright raster the existing plan-to-3D pipeline already expects. */
export async function importCadDrawing(
  project: Project,
  file: File,
  format: CadFormat,
  stage: (stage: CadStage) => void,
): Promise<CadImport> {
  const projectId = projectIdOf(project)
  await requireConverter(format)
  // A fresh source id keeps the link the worker creates exclusive to this drawing.
  const sourceId = uid('source')
  stage('uploading')
  const assetId = await uploadCadOriginal(projectId, file, format)
  stage('converting')
  const ticket = await startCadConversion(projectId, sourceId, assetId)
  const converted =
    ticket.jobId === null ? reused(ticket) : await waitForCadConversion(projectId, ticket.jobId)
  if (!(converted.width > 0 && converted.height > 0))
    throw new Error('The converted drawing reported an unusable page size.')
  stage('downloading')
  const blob = await downloadPrivateAsset(projectId, converted.rasterAssetId)
  return {
    document: {
      id: sourceId,
      name: file.name,
      mime: cadMimeFor(format),
      originalBytes: file.size,
      width: converted.width,
      height: converted.height,
      ...(converted.metresPerPixel ? { metresPerPixel: converted.metresPerPixel } : {}),
      units: converted.units,
    },
    blob,
    pages: 1,
  }
}
