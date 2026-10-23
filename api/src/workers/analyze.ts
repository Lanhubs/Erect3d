import type { Database } from '../db/connection'
import type { Config } from '../config/env'
import type { Job } from '../jobs/queue'
import type { ObjectStore } from '../storage/objects'
import { requireStore } from '../storage/objects'
import type { PlanIntelligenceProvider, IntelligenceResult } from '../modules/ai/provider'
import { ProviderFailure, classifyFailure } from '../modules/ai/provider'
import { analysisJob, intelligenceSchema, type Intelligence } from '../contracts/analysis'
import { parse } from '../contracts/http'
import { requireValue, ApiError } from '../security/errors'
import { assertLease } from '../jobs/lease'
import { analysisPasses, reconcile } from '../modules/ai/reconcile'
import { bytesHash } from '../modules/assets/validation'
import { emit } from '../modules/audit/service'
import { prepareAiImage } from './ai-image'
import { enhanceProposal } from '../modules/ai/enhancement'
import { sourceDocument, sourceDetails } from './source-document'
import { reconstructionScale } from '../modules/plan-analysis/reconstruction-scale'
import { modelQuality } from '../modules/plan-analysis/quality'
import { validatedReconstruction, inspectReconstruction } from './validated-reconstruction'
import { loadDocument } from '../modules/projects/documents'
import { measureSource, classifiedMeasurements } from './source-measurements'
import { sourceEnvelope } from './source-envelope'
import { alignOpeningHosts } from './opening-hosts'
import { guardMeasurementAudit } from './measurement-audit'
import { analysisProgress } from './analysis-progress'
import { retainDetailWarning } from '../modules/plan-analysis/detail-regression'
import { readDesignReference } from './design-reference'
import { inSourceRegion } from './source-region'
export async function analyze(
  db: Database,
  config: Config,
  store: ObjectStore | undefined,
  provider: PlanIntelligenceProvider | undefined,
  job: Job,
  signal: AbortSignal,
) {
  if (!provider) throw new ProviderFailure('AI_UNAVAILABLE', false)
  const input = parse(analysisJob, job.payload)
  const direct =
    input.options.engine === 'backend' &&
    input.options.purpose === 'rebuild' &&
    input.options.strategy !== 'detailed'
  if (direct)
    signal = AbortSignal.any([signal, AbortSignal.timeout(Math.max(180000, config.AI_TIMEOUT_MS * 2))])
  let stages = analysisPasses(
    input.options.mode,
    input.options.complex,
    input.options.architectureCompletion,
    input.options.engine === 'backend',
    direct,
  )
  await analysisProgress(db, job, 'measure-source', stages)
  const [analysis] = await db`SELECT * FROM analyses WHERE id=${job.id}`
  const [asset] =
    await db`SELECT * FROM assets WHERE id=${input.sourceAssetId} AND project_id=${job.project_id} AND state='ready'`
  requireValue(analysis)
  requireValue(asset)
  const bytes = await requireStore(store).read(asset.object_key, config.MAX_UPLOAD_BYTES)
  if (bytesHash(bytes) !== analysis.source_hash) throw new ProviderFailure('SOURCE_HASH_MISMATCH', false)
  const prepared = await prepareAiImage(bytes)
  const crop = input.options.region ? await prepareAiImage(bytes, input.options.region) : undefined
  const backend = input.options.engine === 'backend',
    rebuilding = input.options.purpose === 'rebuild'
  const designReference = await readDesignReference(
    db,
    requireStore(store),
    job.project_id,
    input,
    config.MAX_UPLOAD_BYTES,
  )
  const nativeMeasurements = backend ? await measureSource(bytes, input.options.region) : undefined
  const measurements = nativeMeasurements
    ? {
        ...nativeMeasurements,
        candidates: nativeMeasurements.candidates.filter((c) => inSourceRegion(c, input.options.region)),
      }
    : undefined
  const complex = input.options.complex || Boolean(measurements?.complex)
  stages = analysisPasses(input.options.mode, complex, input.options.architectureCompletion, backend, direct)
  if (complex !== input.options.complex)
    await db`UPDATE analyses SET options=${{ ...input.options, complex }}::jsonb WHERE id=${job.id}`
  const document = backend ? await sourceDocument(db, requireStore(store), job.project_id, input) : undefined
  const details = backend
    ? await sourceDetails(bytes, asset.metadata.width, asset.metadata.height, complex, input.options.region)
    : undefined
  const proposals: Intelligence[] = []
  let auditBaseline: Intelligence | undefined
  let auditPrepared = false
  const current = backend && rebuilding ? await loadDocument(db, job.project_id) : undefined
  for (const pass of stages) {
    signal.throwIfAborted()
    const auditing = pass.startsWith('native-measurement-audit'),
      batch = Number(pass.split('-').at(-1)) - 1
    const measured = auditing
      ? measurements?.candidates
          .filter((item) => item.id.startsWith('cv_edge_'))
          .slice(batch * 100, (batch + 1) * 100) || []
      : measurements?.candidates || []
    if (auditing && current && !auditPrepared) {
      auditPrepared = true
      const scale = reconstructionScale(input, proposals[0], asset.metadata.width, asset.metadata.height)
      let base = reconcile(
        classifiedMeasurements(measurements?.candidates || [], proposals, asset.metadata),
        proposals,
        input.options.mode,
        {
          width: asset.metadata.width,
          height: asset.metadata.height,
          metresPerPixel: scale.calibration.metresPerPixel,
        },
      )
      base = alignOpeningHosts(await sourceEnvelope(base, bytes), asset.metadata.width, asset.metadata.height)
      const checked = await validatedReconstruction(
        db,
        config,
        job,
        input,
        current.document,
        base,
        provider,
        {
          ...prepared,
          width: asset.metadata.width,
          height: asset.metadata.height,
          candidates: base.candidates,
          pass: 'validated-model-repair',
          model: analysis.model,
          calibration: scale.calibration,
          purpose: input.options.purpose,
          engine: input.options.engine,
          document,
          details,
        },
        signal,
      )
      if (checked.quality.status !== 'blocked') auditBaseline = checked.proposal
      proposals.splice(0, proposals.length, checked.proposal)
    }
    const [cached] =
      await db`SELECT proposal FROM analysis_passes WHERE analysis_id=${job.id} AND pass=${pass}`
    if (auditing && !cached && !measured.length) {
      const proposal: Intelligence = {
        coordinatesVersion: 1,
        coordinateSystem: 'normalized-image-top-left',
        candidates: [],
        warnings: [],
      }
      await db.begin(async (tx) => {
        await assertLease(tx, job)
        await tx`INSERT INTO analysis_passes(analysis_id,pass,proposal,usage) VALUES (${job.id},${pass},${proposal}::jsonb,${{ skippedEmptyBatch: 1 }}::jsonb) ON CONFLICT DO NOTHING`
      })
      proposals.push(proposal)
      continue
    }
    if (cached) {
      const proposal = parse(intelligenceSchema, cached.proposal)
      if (['global-understanding', 'consistency', 'architecture-completion'].includes(pass)) {
        proposal.candidates = []
        proposal.dispositions = []
      }
      proposal.candidates = proposal.candidates.map(({ action, ...candidate }) => candidate)
      if (pass !== 'architecture-completion') proposal.designs = []
      proposals.push(auditing ? guardMeasurementAudit(proposal, measured, auditBaseline) : proposal)
      continue
    }
    const model = pass.includes('fixtures') ? config.GEMINI_MODEL_FAST : analysis.model
    await analysisProgress(db, job, pass, stages, proposals.map((_, index) => stages[index]).filter(Boolean))
    const callId = await db.begin(async (tx) => {
      await assertLease(tx, job)
      const [call] =
        await tx`INSERT INTO ai_calls(analysis_id,actor_id,model,pass) VALUES (${job.id},${job.actor_id},${model},${pass}) RETURNING id`
      return call.id
    })
    const timeout = AbortSignal.any([signal, AbortSignal.timeout(config.AI_TIMEOUT_MS)])
    const detail = pass.startsWith('detail-') ? details?.[Number(pass.split('-')[1]) - 1] : undefined
    let response: IntelligenceResult, proposal: Intelligence
    try {
      response = await provider.interpret(
        {
          ...prepared,
          width: asset.metadata.width,
          height: asset.metadata.height,
          candidates: [
            ...new Map(
              [
                ...(backend ? measured : input.deterministicCandidates),
                ...proposals.flatMap((item) => item.candidates),
              ].map((item) => [item.id, item]),
            ).values(),
          ].slice(0, 2000),
          pass,
          region: detail?.region || input.options.region,
          model,
          crop: detail || crop,
          calibration: proposals[0]
            ? reconstructionScale(input, proposals[0], asset.metadata.width, asset.metadata.height)
                .calibration
            : input.calibration,
          understanding: proposals.find((item) => item.understanding)?.understanding,
          designMode: input.options.designMode,
          designReference: ['global-understanding', 'reconstruct-model'].includes(pass)
            ? designReference
            : undefined,
          currentModel: rebuilding ? [] : input.context?.candidates,
          purpose: input.options.purpose,
          engine: input.options.engine,
          document,
          details: detail ? undefined : details,
        },
        timeout,
      )
      proposal = parse(intelligenceSchema, response.proposal)
      if (['global-understanding', 'consistency', 'architecture-completion'].includes(pass)) {
        proposal.candidates = []
        proposal.dispositions = []
      }
      proposal.candidates = proposal.candidates.map(({ action, ...candidate }) => candidate)
      if (pass !== 'architecture-completion') proposal.designs = []
    } catch (error) {
      const failure =
        error instanceof ApiError
          ? { code: error.status === 422 ? 'AI_SCHEMA_MISMATCH' : error.code }
          : classifyFailure(error)
      await db`UPDATE ai_calls SET failure_code=${failure.code} WHERE id=${callId}`
      if (!auditing || signal.aborted) throw error
      proposal = {
        coordinatesVersion: 1,
        coordinateSystem: 'normalized-image-top-left',
        candidates: [],
        warnings: [
          'Fine measurements remain unclassified because the additional source audit was unavailable. The completed structure is retained.',
        ],
      }
      response = { proposal }
    }
    await db.begin(async (tx) => {
      await assertLease(tx, job)
      await tx`INSERT INTO analysis_passes(analysis_id,pass,proposal,usage)
        VALUES (${job.id},${pass},${proposal}::jsonb,${response.usage || {}}::jsonb) ON CONFLICT DO NOTHING`
      await tx`UPDATE ai_calls SET usage=${response.usage || {}}::jsonb WHERE id=${callId}`
    })
    proposals.push(auditing ? guardMeasurementAudit(proposal, measured, auditBaseline) : proposal)
  }
  const effective = reconstructionScale(input, proposals[0], asset.metadata.width, asset.metadata.height)
  const reconciled = reconcile(
    backend
      ? [
          ...(auditBaseline?.candidates || []),
          ...classifiedMeasurements(measurements?.candidates || [], proposals, asset.metadata),
        ]
      : input.options.purpose === 'enhance'
        ? []
        : input.deterministicCandidates,
    proposals,
    input.options.mode,
    {
      width: asset.metadata.width,
      height: asset.metadata.height,
      metresPerPixel: effective.calibration.metresPerPixel,
    },
    rebuilding ? [] : input.context?.candidates,
  )
  let proposal = rebuilding
    ? {
        ...reconciled,
        candidates: reconciled.candidates.map(({ targetId, action, confirmedFields, ...item }) => item),
      }
    : enhanceProposal(reconciled, input.context?.candidates || [])
  if (backend && rebuilding)
    proposal = alignOpeningHosts(
      await sourceEnvelope(proposal, bytes),
      asset.metadata.width,
      asset.metadata.height,
    )
  if (backend && rebuilding && !proposal.candidates.some((item) => item.kind === 'wall'))
    throw new ProviderFailure('AI_NO_STRUCTURE', false)
  let quality = modelQuality(proposal, undefined, undefined, input.calibration.method === 'manual')
  if (backend && rebuilding && current) {
    await analysisProgress(db, job, 'model-validation', stages, stages)
    if (
      auditBaseline &&
      inspectReconstruction(current.document, input, job.id, proposal, {
        width: asset.metadata.width,
        height: asset.metadata.height,
      }).status === 'blocked'
    ) {
      proposal = {
        ...auditBaseline,
        warnings: [
          ...auditBaseline.warnings,
          'Additional fine measurements could not form a valid model. The validated reconstruction was preserved.',
        ].slice(0, 100),
      }
    }
    const validated = await validatedReconstruction(
      db,
      config,
      job,
      input,
      current.document,
      proposal,
      provider,
      {
        ...prepared,
        width: asset.metadata.width,
        height: asset.metadata.height,
        candidates: proposal.candidates,
        pass: 'validated-model-repair',
        model: analysis.model,
        calibration: effective.calibration,
        purpose: input.options.purpose,
        engine: input.options.engine,
        document,
        details,
      },
      signal,
    )
    proposal = validated.proposal
    quality = validated.quality
  }
  if (backend && rebuilding && !proposal.candidates.some((item) => item.kind === 'wall'))
    throw new ProviderFailure('AI_NO_STRUCTURE', false)
  if (current && rebuilding)
    quality = retainDetailWarning(current.document, input, proposal, quality, measurements?.report)
  const models = await db`SELECT DISTINCT model FROM ai_calls WHERE analysis_id=${job.id} ORDER BY model`
  const reused =
    await db`SELECT pass,usage->>'reusedFromAnalysisId' AS "analysisId" FROM analysis_passes WHERE analysis_id=${job.id} AND usage ? 'reusedFromAnalysisId' ORDER BY pass`
  const result = {
    proposal,
    quality,
    calibration: reconstructionScale(input, proposal, asset.metadata.width, asset.metadata.height)
      .calibration,
    dimensions: { width: asset.metadata.width, height: asset.metadata.height, orientation: 1 },
    provenance: {
      analysisId: job.id,
      sourceAssetId: input.sourceAssetId,
      sourceHash: analysis.source_hash,
      model: analysis.model,
      models: models.map((row: { model: string }) => row.model),
      promptVersion: analysis.prompt_version,
      schemaVersion: analysis.schema_version,
      options: { ...input.options, complex },
      measurements: measurements?.report,
      imageProcessing: 'original bytes; native lossless detail crops',
      reusedPasses: reused,
    },
  }
  await db.begin(async (tx) => {
    await assertLease(tx, job)
    await tx`UPDATE analyses SET result=${result}::jsonb,status='ready' WHERE id=${job.id} AND status='pending'`
    await emit(tx, job.project_id, 'analysis.ready', { analysisId: job.id })
  })
  return { analysisId: job.id, candidateCount: proposal.candidates.length }
}
