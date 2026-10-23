import type { Database } from '../db/connection'
import type { AnalysisJob } from '../contracts/analysis'
import type { ObjectStore } from '../storage/objects'
import { bytesHash, sniff } from '../modules/assets/validation'
import { ProviderFailure } from '../modules/ai/provider'
import { prepareAiImage } from './ai-image'
import type { SourceRegion } from './source-region'

export async function sourceDocument(
  db: Database,
  store: ObjectStore,
  projectId: string,
  input: AnalysisJob,
) {
  if (!input.document) return undefined
  const reference = input.document
  const [asset] =
    await db`SELECT object_key,sha256 FROM assets WHERE id=${reference.assetId} AND project_id=${projectId} AND state='ready' AND mime='application/pdf' AND kind='source'`
  if (!asset || asset.sha256 !== reference.sha256) throw new ProviderFailure('SOURCE_DOCUMENT_CHANGED', false)
  const bytes = await store.read(asset.object_key, 50 * 1024 * 1024)
  if (bytesHash(bytes) !== reference.sha256 || sniff(bytes) !== 'application/pdf')
    throw new ProviderFailure('SOURCE_HASH_MISMATCH', false)
  return { bytes, mime: 'application/pdf' as const, page: reference.page }
}
export async function sourceDetails(
  bytes: Uint8Array,
  width: number,
  height: number,
  complex = false,
  selected?: SourceRegion,
) {
  if (!complex && Math.max(width, height) <= 2400) return []
  const result = []
  // Four overlapping quadrants preserve context around joins and dimension text.
  for (const y of [0, 0.45])
    for (const x of [0, 0.45]) {
      const area = selected || { x: 0, y: 0, width: 1, height: 1 }
      const region = {
          x: area.x + x * area.width,
          y: area.y + y * area.height,
          width: 0.55 * area.width,
          height: 0.55 * area.height,
        },
        image = await prepareAiImage(bytes, region)
      result.push({ ...image, region })
    }
  return result
}
