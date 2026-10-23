import type { Database } from '../db/connection'
import type { AnalysisJob } from '../contracts/analysis'
import type { ObjectStore } from '../storage/objects'
import { ApiError } from '../security/errors'
import { bytesHash } from '../modules/assets/validation'
export async function readDesignReference(
  db: Database,
  store: ObjectStore,
  projectId: string,
  input: AnalysisJob,
  maximum: number,
) {
  if (input.options.designMode !== 'creative' || !input.options.styleReferenceAssetId) return undefined
  const [asset] =
    await db`SELECT * FROM assets WHERE id=${input.options.styleReferenceAssetId} AND project_id=${projectId} AND state='ready'`
  if (!asset || !['image/png', 'image/jpeg', 'image/webp'].includes(asset.mime))
    throw new ApiError(422, 'REFERENCE_IMAGE_REQUIRED', 'The design reference is unavailable')
  const bytes = await store.read(asset.object_key, maximum)
  if (bytesHash(bytes) !== asset.sha256)
    throw new ApiError(422, 'REFERENCE_HASH_MISMATCH', 'The design reference bytes changed')
  return { bytes, mime: asset.mime }
}
