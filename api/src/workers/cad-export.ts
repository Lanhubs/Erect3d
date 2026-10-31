import { z } from 'zod'
import type { Database } from '../db/connection'
import type { Config } from '../config/env'
import type { Job } from '../jobs/queue'
import type { ObjectStore } from '../storage/objects'
import { requireStore } from '../storage/objects'
import { parse } from '../contracts/http'
import { revision } from '../contracts/primitives'
import { newId } from '../security/tokens'
import { loadDocument } from '../modules/projects/documents'
import { writeDerivedAsset } from './output'
import { dwgFromDxf } from './dwg-export'
import { cadMimeFor } from '../modules/cad/signature'
import { buildCadScene } from '../../../client/src/cad/scene'
import { cadSheetName } from '../../../client/src/cad/sheetName'
import { writeDxf } from '../../../client/src/cad/dxf-writer'

export const cadExportInput = z
  .object({
    format: z.enum(['dxf', 'dwg']),
    revision,
    levelId: z.string().min(1).max(60).optional(),
    allLevels: z.boolean().optional(),
  })
  .strict()
export type CadExportPayload = z.infer<typeof cadExportInput>

/** The drawing is built in-process from the same shared scene the browser exports. */
export async function exportCad(db: Database, config: Config, store: ObjectStore | undefined, job: Job) {
  const input = parse(cadExportInput, job.payload),
    snapshot = await loadDocument(db, job.project_id, input.revision),
    storage = requireStore(store),
    scene = buildCadScene(snapshot.document, { levelId: input.levelId, allLevels: input.allLevels }),
    dxf = new TextEncoder().encode(writeDxf(scene)),
    converted = await dwgFromDxf(dxf, config, input.format),
    format = converted ? ('dwg' as const) : ('dxf' as const),
    name = cadSheetName(snapshot.document, input, format),
    assetId = newId('asset')
  await writeDerivedAsset(db, storage, job, assetId, {
    bytes: converted?.bytes || dxf,
    name,
    mime: cadMimeFor(format),
    kind: 'export',
    metadata: {
      revision: input.revision,
      format,
      entities: scene.entities.length,
      ...(converted ? { converter: converted.converter, derivedFrom: 'dxf' } : {}),
    },
  })
  return { assetId, format, name, revision: input.revision, entities: scene.entities.length }
}
