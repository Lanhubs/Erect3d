import { api } from './api'
import { waitForJob } from './jobs'
import { downloadPrivateAsset } from './sources'
import { cloudPersistence } from '../state/persistenceMode'
import type { Project } from '../domain/types'
import type { CadSceneOptions } from '../cad/scene'
import { cadSheetName, type CadSheetFormat } from '../cad/sheetName'

export type CadExportResult = {
  assetId: string
  format: CadSheetFormat
  name: string
  revision: number
  entities: number
}

/** A device project has no server to stamp a revision or run a converter on. */
export const cloudExportRequired =
  'Cloud sheets need the project saved to the cloud. This device can still draw the same DXF file and hand it to you.'

const jobFailure = (code: string | null) =>
  code === 'DWG_CONVERTER_UNAVAILABLE'
    ? 'This server has no DWG converter installed. Export the drawing as DXF; it opens in the same tools.'
    : code === 'UNKNOWN_LEVEL'
      ? 'This floor is no longer in the building. Pick a floor and export again.'
      : `The sheet could not be drawn (${code || 'an unknown reason'}). Export one floor at a time, or export DXF from this device.`

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** The server stamps its own clock on a patch, so the draft is committed once that time is visible. */
async function syncedRevision(project: Project) {
  const deadline = Date.now() + 20000
  for (;;) {
    const snapshot = await api.load(project.id)
    if (snapshot.document.modified >= project.modified) return snapshot.revision
    if (Date.now() > deadline)
      throw new Error('The cloud copy has not caught up with this device. Retry the sync and export again.')
    await wait(400)
  }
}

/** Cloud sheets are drawn by the same scene and writer on the server, which is what makes DWG possible. */
export async function exportCadSheet(
  project: Project,
  format: CadSheetFormat,
  options: CadSceneOptions,
): Promise<{ blob: Blob; name: string }> {
  const cloud = cloudPersistence()
  if (!cloud || cloud.projectId !== project.id) throw new Error(cloudExportRequired)
  await cloud.save(project)
  const revision = await syncedRevision(project),
    { jobId } = await api.request<{ jobId: string }>(
      `/projects/${project.id}/exports`,
      'POST',
      {
        format,
        revision,
        ...(options.levelId ? { levelId: options.levelId } : {}),
        ...(options.allLevels ? { allLevels: true } : {}),
      },
      crypto.randomUUID(),
    ),
    result = await waitForJob<CadExportResult>(project.id, jobId, {
      limitMs: 180000,
      failure: jobFailure,
      patience: 'The sheet is still being drawn. Reload this project in a moment and export it again.',
    })
  return {
    blob: await downloadPrivateAsset(project.id, result.assetId),
    name: cadSheetName(project, options, result.format),
  }
}
