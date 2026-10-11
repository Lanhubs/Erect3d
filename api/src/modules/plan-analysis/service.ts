import type { Database } from '../../db/connection'
import type { Config } from '../../config/env'
import type { Actor } from '../auth/session'
import type { AnalysisInput } from '../../contracts/analysis'
import { authorize } from '../../security/permissions'
import { ApiError, requireValue } from '../../security/errors'
import { checksum } from '../../security/tokens'
import { idempotent } from '../../security/idempotency'
import { enqueue } from '../../jobs/queue'
import { audit } from '../audit/service'
import { promptVersion } from '../ai/gemini'
import { loadDocument } from '../projects/documents'

export async function requestAnalysis(db: Database, config: Config, actor: Actor, projectId: string,
  input: AnalysisInput, key: string | undefined, requestId: string) {
  if (!config.GEMINI_API_KEY) throw new ApiError(503, 'AI_UNAVAILABLE', 'Cloud interpretation has not been configured')
  return idempotent(db, actor.id, `analysis:${projectId}`, key, input, async tx => {
    const project = await authorize(tx, actor, projectId, 'edit')
    const [asset] = await tx`SELECT * FROM assets WHERE id=${input.sourceAssetId} AND project_id=${projectId} AND state='ready'`
    requireValue(asset)
    if (!asset.mime.startsWith('image/') || !['source','raster'].includes(asset.kind)) throw new ApiError(422, 'RASTER_REQUIRED', 'Analyze an upright source image or a selected PDF page raster')
    const { document } = await loadDocument(tx, projectId)
    const level = document.buildings.flatMap(building => building.levels).find(level => level.id === input.levelId)
    const source = document.sources.find(source => source.id === input.sourceId)
    if (!level || !source || level.sourceId !== source.id || source.width !== asset.metadata.width || source.height !== asset.metadata.height) {
      throw new ApiError(422, 'SOURCE_MISMATCH', 'Source, level and raster dimensions must match the current document')
    }
    if ((asset.metadata.orientation || 1) !== 1) throw new ApiError(422, 'UPRIGHT_RASTER_REQUIRED', 'Use the normalized upright raster for interpretation')
    const model = input.options.complex ? config.GEMINI_MODEL_COMPLEX : config.GEMINI_MODEL_PLAN
    const cacheKey = checksum({ hash: asset.sha256, input, model,fastModel:config.GEMINI_MODEL_FAST, promptVersion, schemaVersion: 1 })
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${`analysis-cache:${projectId}:${cacheKey}`},0))`
    const [cached] = await tx`SELECT a.id,j.status FROM analyses a JOIN jobs j ON j.id=a.id
      WHERE a.project_id=${projectId} AND a.cache_key=${cacheKey} AND j.status IN ('queued','running','completed')
      AND a.status IN ('pending','ready') ORDER BY a.created_at DESC LIMIT 1`
    if (cached) return { analysisId: cached.id, cached: true }
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${`ai-quota:${actor.id}`},0))`
    const [usage] = await tx`SELECT count(*)::int AS count FROM ai_usage WHERE actor_id=${actor.id} AND created_at>now()-interval '24 hours'`
    if (usage.count >= config.AI_DAILY_LIMIT) throw new ApiError(429, 'AI_QUOTA', 'Your daily cloud analysis allowance is used')
    const id = await enqueue(tx, actor, projectId, 'plan.analyze', input, requestId)
    await tx`INSERT INTO analyses(id,project_id,source_asset_id,source_hash,cache_key,model,prompt_version,schema_version,options)
      VALUES (${id},${projectId},${input.sourceAssetId},${asset.sha256},${cacheKey},${model},${promptVersion},1,${input.options}::jsonb)`
    await tx`INSERT INTO ai_usage(actor_id,team_id,project_id,job_id,model,kind) VALUES (${actor.id},${project.team_id},${projectId},${id},${model},'plan.analyze')`
    await audit(tx, actor, projectId, 'analysis.requested', requestId, { analysisId: id, sourceAssetId: input.sourceAssetId })
    return { analysisId: id, cached: false }
  })
}
