import type { Database } from '../db/connection'
import type { Config } from '../config/env'
import type { Job } from '../jobs/queue'
import type { ObjectStore } from '../storage/objects'
import { requireStore } from '../storage/objects'
import type { PlanIntelligenceProvider, IntelligenceResult } from '../modules/ai/provider'
import { ProviderFailure, classifyFailure } from '../modules/ai/provider'
import { analysisRequest, intelligenceSchema, type Intelligence } from '../contracts/analysis'
import { parse } from '../contracts/http'
import { requireValue, ApiError } from '../security/errors'
import { assertLease } from '../jobs/lease'
import { analysisPasses, reconcile } from '../modules/ai/reconcile'
import { bytesHash } from '../modules/assets/validation'
import { emit } from '../modules/audit/service'
import { prepareAiImage } from './ai-image'
export async function analyze(db: Database, config: Config, store: ObjectStore | undefined,
  provider: PlanIntelligenceProvider | undefined, job: Job, signal: AbortSignal) {
  if (!provider) throw new ProviderFailure('AI_UNAVAILABLE', false)
  const input = parse(analysisRequest, job.payload)
  const [analysis] = await db`SELECT * FROM analyses WHERE id=${job.id}`
  const [asset] = await db`SELECT * FROM assets WHERE id=${input.sourceAssetId} AND project_id=${job.project_id} AND state='ready'`
  requireValue(analysis); requireValue(asset)
  const bytes = await requireStore(store).read(asset.object_key, config.MAX_UPLOAD_BYTES)
  if (bytesHash(bytes) !== analysis.source_hash) throw new ProviderFailure('SOURCE_HASH_MISMATCH', false)
  const prepared = await prepareAiImage(bytes)
  const proposals: Intelligence[] = []
  for (const pass of analysisPasses(input.options.mode, input.options.complex)) {
    signal.throwIfAborted()
    const [cached] = await db`SELECT proposal FROM analysis_passes WHERE analysis_id=${job.id} AND pass=${pass}`
    if (cached) { proposals.push(parse(intelligenceSchema, cached.proposal)); continue }
    const model = pass.includes('fixtures') ? config.GEMINI_MODEL_FAST : analysis.model
    const callId = await db.begin(async tx => {
      await assertLease(tx, job)
      const [call] = await tx`INSERT INTO ai_calls(analysis_id,actor_id,model,pass) VALUES (${job.id},${job.actor_id},${model},${pass}) RETURNING id`
      return call.id
    })
    const timeout = AbortSignal.any([signal, AbortSignal.timeout(config.AI_TIMEOUT_MS)])
    let response: IntelligenceResult, proposal: Intelligence
    try {
      response = await provider.interpret({
        ...prepared, width: asset.metadata.width, height: asset.metadata.height,
        candidates: [...input.deterministicCandidates, ...proposals.flatMap(item => item.candidates)].slice(0, 2000),
        pass, region: input.options.region, model,
      }, timeout)
      proposal = parse(intelligenceSchema, response.proposal)
    } catch (error) {
      const failure = error instanceof ApiError ? { code:error.status===422?'AI_SCHEMA_MISMATCH':error.code } : classifyFailure(error)
      await db`UPDATE ai_calls SET failure_code=${failure.code} WHERE id=${callId}`
      throw error
    }
    await db.begin(async tx => {
      await assertLease(tx, job)
      await tx`INSERT INTO analysis_passes(analysis_id,pass,proposal,usage)
        VALUES (${job.id},${pass},${proposal}::jsonb,${response.usage || {}}::jsonb) ON CONFLICT DO NOTHING`
      await tx`UPDATE ai_calls SET usage=${response.usage || {}}::jsonb WHERE id=${callId}`
    })
    proposals.push(proposal)
  }
  const proposal = reconcile(input.deterministicCandidates, proposals, input.options.mode)
  const models = await db`SELECT DISTINCT model FROM ai_calls WHERE analysis_id=${job.id} ORDER BY model`
  const result = {
    proposal, dimensions: { width: asset.metadata.width, height: asset.metadata.height, orientation: 1 },
    provenance: {
      analysisId: job.id, sourceAssetId: input.sourceAssetId, sourceHash: analysis.source_hash,
      model: analysis.model,models:models.map((row:{ model:string })=>row.model), promptVersion: analysis.prompt_version, schemaVersion: analysis.schema_version, options: input.options
    }
  }
  await db.begin(async tx => {
    await assertLease(tx, job)
    await tx`UPDATE analyses SET result=${result}::jsonb,status='ready' WHERE id=${job.id} AND status='pending'`
    await emit(tx, job.project_id, 'analysis.ready', { analysisId: job.id })
  })
  return { analysisId: job.id, candidateCount: proposal.candidates.length }
}
