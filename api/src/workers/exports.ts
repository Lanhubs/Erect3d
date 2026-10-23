import { z } from 'zod'
import type { Database } from '../db/connection'
import type { Job } from '../jobs/queue'
import type { ObjectStore } from '../storage/objects'
import { requireStore } from '../storage/objects'
import { parse } from '../contracts/http'
import { revision } from '../contracts/primitives'
import { assertLease } from '../jobs/lease'
import { digest } from '../security/tokens'
import { loadDocument, saveSnapshot } from '../modules/projects/documents'
import { projectQuantities } from '../modules/quantities/service'
import { writeDerivedAsset } from './output'
export const exportInput = z
  .object({ format: z.enum(['project-json', 'quantities-json']), revision })
  .strict()
export async function exportProject(db: Database, store: ObjectStore | undefined, job: Job) {
  const input = parse(exportInput, job.payload),
    snapshot = await loadDocument(db, job.project_id, input.revision)
  const data = input.format === 'project-json' ? snapshot : projectQuantities(snapshot.document)
  const bytes = new TextEncoder().encode(JSON.stringify(data)),
    storage = requireStore(store)
  const id = `asset_${digest(`${job.id}:export`).slice(0, 32)}`
  await writeDerivedAsset(db, storage, job, id, {
    bytes,
    mime: 'application/json',
    name: `${snapshot.document.name}.json`,
    kind: 'export',
    metadata: { revision: input.revision, format: input.format },
  })
  return { assetId: id, revision: input.revision }
}
export async function snapshotProject(db: Database, job: Job) {
  const input = parse(z.object({ revision }).strict(), job.payload)
  const snapshot = await loadDocument(db, job.project_id, input.revision)
  await db.begin(async (tx) => {
    await assertLease(tx, job)
    await saveSnapshot(tx, job.project_id, input.revision, snapshot.document)
  })
  return { revision: input.revision, checksum: snapshot.checksum }
}
