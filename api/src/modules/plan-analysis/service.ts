import type { Database } from '../../db/connection'
import type { Config } from '../../config/env'
import type { Actor } from '../auth/session'
import type { AnalysisInput } from '../../contracts/analysis'
import { authorize } from '../../security/permissions'
import { ApiError, requireValue } from '../../security/errors'
import { checksum } from '../../security/tokens'
import { idempotent } from '../../security/idempotency'
import { enqueue } from '../../jobs/queue'
import { audit,emit } from '../audit/service'
import { promptVersion } from '../ai/gemini'
import { loadDocument } from '../projects/documents'
import { captureContext } from './model-context'

export async function requestAnalysis(db: Database, config: Config, actor: Actor, projectId: string,
  input: AnalysisInput, key: string | undefined, requestId: string) {
  if (!config.GEMINI_API_KEY) throw new ApiError(503, 'AI_UNAVAILABLE', 'Cloud interpretation has not been configured')
  if (input.options.purpose==='rebuild' && input.options.engine!=='backend') throw new ApiError(422,'FULL_SOURCE_REQUIRED','Reconstruct a complete floor with the backend engine')
  return idempotent(db, actor.id, `analysis:${projectId}`, key, input, async tx => {
    const project = await authorize(tx, actor, projectId, 'edit')
    const [asset] = await tx`SELECT * FROM assets WHERE id=${input.sourceAssetId} AND project_id=${projectId} AND state='ready'`
    requireValue(asset)
    if(input.options.styleReferenceAssetId){
      const [reference]=await tx`SELECT id,mime FROM assets WHERE id=${input.options.styleReferenceAssetId} AND project_id=${projectId} AND state='ready'`
      if(!reference || !['image/png','image/jpeg','image/webp'].includes(reference.mime))throw new ApiError(422,'REFERENCE_IMAGE_REQUIRED','Choose an uploaded image from this project as the design reference')
    }
    if (!asset.mime.startsWith('image/') || !['source','raster'].includes(asset.kind)) throw new ApiError(422, 'RASTER_REQUIRED', 'Analyze an upright source image or a selected PDF page raster')
    const { document, revision } = await loadDocument(tx, projectId)
    const level = document.buildings.flatMap(building => building.levels).find(level => level.id === input.levelId)
    const source = document.sources.find(source => source.id === input.sourceId)
    if (!level || !source || level.sourceId !== source.id || source.width !== asset.metadata.width || source.height !== asset.metadata.height) {
      throw new ApiError(422, 'SOURCE_MISMATCH', 'Source, level and raster dimensions must match the current document')
    }
    if ((asset.metadata.orientation || 1) !== 1) throw new ApiError(422, 'UPRIGHT_RASTER_REQUIRED', 'Use the normalized upright raster for interpretation')
    const calibration = level.calibration || document.calibration
    if (!calibration || checksum(calibration) !== checksum(input.calibration) || checksum(level.alignment || null) !== checksum(input.alignment || null)) {
      throw new ApiError(409, 'SOURCE_CHANGED', 'Sync the current source scale and alignment before requesting interpretation')
    }
    const model = input.options.complex ? config.GEMINI_MODEL_COMPLEX : config.GEMINI_MODEL_PLAN
    const [linked]=await tx`SELECT a.id,a.sha256,a.size,a.metadata,a.mime,a.state,s.raster_asset_id,s.page FROM source_plans s JOIN assets a ON a.id=s.original_asset_id
      WHERE s.project_id=${projectId} AND s.source_id=${source.id} AND a.project_id=${projectId}`
    const nativePdf=input.options.engine==='backend' && source.mime==='application/pdf'
    if (nativePdf && (!linked || linked.state!=='ready' || linked.mime!=='application/pdf' || linked.raster_asset_id!==asset.id || linked.page!==source.page || input.page!==source.page)) {
      throw new ApiError(422,'PDF_SOURCE_REQUIRED','Link the original PDF and its selected page before backend reconstruction')
    }
    if (nativePdf && (Number(linked.metadata?.optimization?.inputBytes || linked.size)>50*1024*1024 || (source.pages || 1)>1000)) throw new ApiError(422,'AI_DOCUMENT_LIMIT','Backend PDF interpretation supports at most 50 MB and 1,000 pages; split this document before analysis')
    const payload = { ...input, context: captureContext(document, input, revision, source.width, source.height),
      ...(nativePdf?{ document:{assetId:linked.id,sha256:linked.sha256,page:source.page!} }:{}) }
    const cacheKey = checksum({ hash: asset.sha256,documentHash:linked?.sha256, input: payload, model,fastModel:config.GEMINI_MODEL_FAST, promptVersion, schemaVersion: 5 })
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${`analysis-cache:${projectId}:${cacheKey}`},0))`
    const [cached] = await tx`SELECT a.id,j.status FROM analyses a JOIN jobs j ON j.id=a.id
      WHERE a.project_id=${projectId} AND a.cache_key=${cacheKey} AND j.status IN ('queued','running','completed')
      AND a.status IN ('pending','ready') AND (a.status<>'ready' OR a.result->'quality'->>'status' IS DISTINCT FROM 'blocked') ORDER BY a.created_at DESC LIMIT 1`
    if (cached) return { analysisId: cached.id, cached: true }
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${`ai-quota:${actor.id}`},0))`
    const [usage] = await tx`SELECT count(*)::int AS count FROM ai_usage WHERE actor_id=${actor.id} AND created_at>now()-interval '24 hours'`
    if (usage.count >= config.AI_DAILY_LIMIT) throw new ApiError(429, 'AI_QUOTA', 'Your daily cloud analysis allowance is used')
    const id = await enqueue(tx, actor, projectId, 'plan.analyze', payload, requestId)
    if(input.options.engine==='backend' && input.options.purpose==='rebuild' && input.options.strategy!=='detailed')await tx`UPDATE jobs SET max_attempts=1 WHERE id=${id}`
    await tx`INSERT INTO analyses(id,project_id,source_asset_id,source_hash,cache_key,model,prompt_version,schema_version,options)
      VALUES (${id},${projectId},${input.sourceAssetId},${asset.sha256},${cacheKey},${model},${promptVersion},5,${input.options}::jsonb)`
    // A timed-out read/repair can resume exact, immutable source work. The cache
    // key includes document hash, settings, revision, model and prompt version.
    if(input.options.engine==='backend' && input.options.purpose==='rebuild'){
      const [prior]=await tx`SELECT a.id FROM analyses a JOIN jobs j ON j.id=a.id WHERE a.project_id=${projectId} AND a.cache_key=${cacheKey}
        AND (a.status='failed' OR a.status='ready' AND a.result->'quality'->'issues' @> '[{"code":"REPAIR_UNAVAILABLE"}]'::jsonb)
        AND j.status IN ('failed','completed') AND EXISTS(SELECT 1 FROM analysis_passes p WHERE p.analysis_id=a.id AND p.pass NOT LIKE 'validated-model-repair%')
        ORDER BY a.created_at DESC LIMIT 1`
      if(prior)await tx`INSERT INTO analysis_passes(analysis_id,pass,proposal,usage)
        SELECT ${id},pass,proposal,usage || jsonb_build_object('reusedFromAnalysisId',${prior.id}::text) FROM analysis_passes
        WHERE analysis_id=${prior.id} AND pass NOT LIKE 'validated-model-repair%' ON CONFLICT DO NOTHING`
    }
    await tx`INSERT INTO ai_usage(actor_id,team_id,project_id,job_id,model,kind) VALUES (${actor.id},${project.team_id},${projectId},${id},${model},'plan.analyze')`
    await audit(tx, actor, projectId, 'analysis.requested', requestId, { analysisId: id, sourceAssetId: input.sourceAssetId })
    await emit(tx,projectId,'analysis.queued',{analysisId:id,status:'pending',job_status:'queued'})
    return { analysisId: id, cached: false }
  })
}
