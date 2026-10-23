import type { Database } from '../db/connection'
import type { Job } from '../jobs/queue'
import type { ObjectStore } from '../storage/objects'
import { assertLease } from '../jobs/lease'
import { enqueue } from '../jobs/queue'
import { bytesHash } from '../modules/assets/validation'
import { ApiError } from '../security/errors'
import { log } from '../security/log'

type Output = {
  bytes: Uint8Array
  name: string
  mime: string
  kind: 'raster' | 'thumbnail' | 'export'
  metadata: Record<string, unknown>
  parentId?: string
}

export async function writeDerivedAsset(
  db: Database,
  storage: ObjectStore,
  job: Job,
  id: string,
  output: Output,
) {
  // Every attempt writes a new key. A cancelled or stale attempt cannot overwrite a newer worker's output.
  const key = `private/${job.project_id}/${id}/${crypto.randomUUID()}`
  await storage.write(key, output.bytes, output.mime)
  let retained = false
  try {
    await db.begin(async (tx) => {
      await assertLease(tx, job)
      const inserted =
        await tx`INSERT INTO assets(id,project_id,actor_id,object_key,name,mime,size,kind,state,sha256,metadata,parent_id)
        VALUES (${id},${job.project_id},${job.actor_id},${key},${output.name},${output.mime},${output.bytes.length},${output.kind},'ready',
          ${bytesHash(output.bytes)},${output.metadata}::jsonb,${output.parentId ?? null}) ON CONFLICT(id) DO NOTHING RETURNING id`
      if (inserted.length) retained = true
      else {
        const [existing] = await tx`SELECT state FROM assets WHERE id=${id} AND project_id=${job.project_id}`
        if (existing?.state !== 'ready')
          throw new ApiError(409, 'ASSET_STATE', 'Previous output is no longer available')
      }
    })
  } catch (error) {
    retained = false
    await cleanup(db, storage, job, key)
    throw error
  }
  if (!retained) await cleanup(db, storage, job, key)
  return id
}
async function cleanup(db: Database, storage: ObjectStore, job: Job, key: string) {
  try {
    await storage.delete(key)
  } catch {
    try {
      await enqueue(
        db,
        { id: job.actor_id, name: 'Worker', email: '', sessionId: '' },
        job.project_id,
        'asset.purge',
        { key },
        job.request_id,
      )
    } catch {
      log('asset.cleanup_failed', { jobId: job.id, requestId: job.request_id })
    }
  }
}
