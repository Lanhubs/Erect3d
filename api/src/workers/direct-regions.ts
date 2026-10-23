import type { Database } from '../db/connection'
import type { Config } from '../config/env'
import type { Job } from '../jobs/queue'
import { intelligenceSchema, type Candidate, type Intelligence } from '../contracts/analysis'
import type { IntelligenceInput, PlanIntelligenceProvider } from '../modules/ai/provider'
import { classifyFailure } from '../modules/ai/provider'
import { parse } from '../contracts/http'
import { assertLease } from '../jobs/lease'
import { analysisProgress } from './analysis-progress'
import { inSourceRegion, type SourceRegion } from './source-region'

// Each measured stroke has exactly one owner. Overlapping crops retain context,
// while coordinates and stable measurement IDs always refer to the original sheet.
export function regionOwner(candidate: Candidate, region?: SourceRegion) {
  const centre = candidate.points.reduce(
    (sum, p) => ({ x: sum.x + p.x / candidate.points.length, y: sum.y + p.y / candidate.points.length }),
    { x: 0, y: 0 },
  )
  return (
    Number(centre.x >= (region ? region.x + region.width / 2 : 0.5)) +
    2 * Number(centre.y >= (region ? region.y + region.height / 2 : 0.5))
  )
}
export function regionalProposal(
  proposal: Intelligence,
  index: number,
  measured: Candidate[],
  region?: SourceRegion,
): Intelligence {
  const native = new Set(measured.map((item) => item.id)),
    prefix = `region${index + 1}_`
  const candidates = proposal.candidates.filter(
    (item) => inSourceRegion(item, region) && (native.has(item.id) || regionOwner(item, region) === index),
  )
  const ids = new Map(
    candidates.map((item) => [item.id, native.has(item.id) ? item.id : `${prefix}${item.id}`]),
  )
  return {
    ...proposal,
    understanding: undefined,
    vision: undefined,
    designs: [],
    architecturalRequirements: proposal.architecturalRequirements
      ? {
          ...proposal.architecturalRequirements,
          systems: proposal.architecturalRequirements.systems
            .filter((s) => s.boundaryId && ids.has(s.boundaryId))
            .map((s) => ({ ...s, id: `${prefix}${s.id}`, boundaryId: ids.get(s.boundaryId!)! })),
        }
      : undefined,
    candidates: candidates.map((item) => ({
      ...item,
      id: ids.get(item.id)!,
      wallId: item.wallId ? ids.get(item.wallId) || item.wallId : undefined,
    })),
    dispositions: proposal.dispositions?.filter((item) => native.has(item.candidateId)),
  }
}
export async function readRegions(
  source: IntelligenceInput,
  signal: AbortSignal,
  invoke: (input: IntelligenceInput, signal: AbortSignal) => Promise<Intelligence>,
  progress: (pass: string, completed: string[]) => Promise<void>,
) {
  let delivery = Promise.resolve()
  const report = (pass: string, completed: string[]) => {
    delivery = delivery.then(() => progress(pass, completed))
    return delivery
  }
  await report('global-understanding', [])
  const perimeterEvidence = source.candidates
    .filter((candidate) => candidate.kind === 'wall')
    .toSorted(
      (a, b) =>
        Math.hypot(b.points[0].x - b.points.at(-1)!.x, b.points[0].y - b.points.at(-1)!.y) -
        Math.hypot(a.points[0].x - a.points.at(-1)!.x, a.points[0].y - a.points.at(-1)!.y),
    )
    .slice(0, 80)
  const global = await invoke(
    {
      ...source,
      pass: 'global-understanding',
      candidates: perimeterEvidence,
      details: undefined,
      crop: undefined,
    },
    signal,
  )
  global.candidates = []
  global.dispositions = []
  global.designs = []
  const completed = ['global-understanding']
  const regions = source.details || []
  if (regions.length !== 4) throw new Error('Dense reconstruction requires four native crops')
  const abort = new AbortController(),
    combined = AbortSignal.any([signal, abort.signal])
  const results = await Promise.allSettled(
    regions.map(async (crop, index) => {
      const pass = `reconstruct-region-${index + 1}`,
        measured = source.candidates.filter((item) => regionOwner(item, source.region) === index)
      combined.throwIfAborted()
      try {
        await report(pass, [...completed])
        const proposal = await invoke(
          {
            ...source,
            pass,
            candidates: measured,
            designReference: undefined,
            document: undefined,
            details: undefined,
            crop,
            region: crop.region,
            understanding: global.understanding,
          },
          combined,
        )
        completed.push(pass)
        await report('reconstruct-regions', [...completed])
        return regionalProposal(proposal, index, measured, source.region)
      } catch (error) {
        abort.abort(error)
        throw error
      }
    }),
  )
  const failed = results.find((result) => result.status === 'rejected')
  if (failed?.status === 'rejected') throw failed.reason
  return [global, ...results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []))]
}
export async function directRegions(
  db: Database,
  config: Config,
  job: Job,
  provider: PlanIntelligenceProvider,
  source: IntelligenceInput,
  signal: AbortSignal,
  stages: string[],
) {
  const invoke = async (input: IntelligenceInput, callSignal: AbortSignal): Promise<Intelligence> => {
    callSignal.throwIfAborted()
    const [cached] =
      await db`SELECT proposal FROM analysis_passes WHERE analysis_id=${job.id} AND pass=${input.pass}`
    if (cached) return parse(intelligenceSchema, cached.proposal)
    const callId = await db.begin(async (tx) => {
      await assertLease(tx, job)
      const [call] =
        await tx`INSERT INTO ai_calls(analysis_id,actor_id,model,pass) VALUES (${job.id},${job.actor_id},${input.model},${input.pass}) RETURNING id`
      return call.id
    })
    try {
      const deadline = input.pass === 'global-understanding' ? (input.document ? 65000 : 25000) : 40000
      const response = await provider.interpret(
        input,
        AbortSignal.any([callSignal, AbortSignal.timeout(Math.min(config.AI_TIMEOUT_MS, deadline))]),
      )
      const proposal = parse(intelligenceSchema, response.proposal)
      await db.begin(async (tx) => {
        await assertLease(tx, job)
        await tx`INSERT INTO analysis_passes(analysis_id,pass,proposal,usage) VALUES (${job.id},${input.pass},${proposal}::jsonb,${response.usage || {}}::jsonb) ON CONFLICT DO NOTHING`
        await tx`UPDATE ai_calls SET usage=${response.usage || {}}::jsonb WHERE id=${callId}`
      })
      return proposal
    } catch (error) {
      await db`UPDATE ai_calls SET failure_code=${classifyFailure(error).code} WHERE id=${callId}`
      throw error
    }
  }
  return readRegions(source, signal, invoke, (pass, completed) =>
    analysisProgress(db, job, pass, stages, completed),
  )
}
