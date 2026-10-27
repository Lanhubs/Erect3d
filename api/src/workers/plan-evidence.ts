import type { Database } from '../db/connection'
import type { Job } from '../jobs/queue'
import type { SourceRegion } from './source-region'
import type { Project } from '../contracts/project'
import type { SourceText } from '../contracts/source-text'
import type { PlanIntelligenceProvider } from '../modules/ai/provider'
import { intelligenceSchema } from '../contracts/analysis'
import { withLevelContext } from '../modules/ai/level-context'
import { measureReconstructionSource } from './source-measurements'
import { readSourceText } from './source-text'
import { analysisProgress } from './analysis-progress'
import { assertLease } from '../jobs/lease'

export async function readPlanEvidence(
  backend: boolean,
  bytes: Uint8Array,
  region: SourceRegion | undefined,
  db: Database,
  job: Job,
  stages: string[],
  signal: AbortSignal,
) {
  if (!backend) return undefined
  await analysisProgress(db, job, 'read-source-text', ['read-source-text', ...stages])
  const [saved] =
    await db`SELECT proposal FROM analysis_passes WHERE analysis_id=${job.id} AND pass='read-source-text'`
  const text = async () => {
    const prior = saved ? intelligenceSchema.parse(saved.proposal).sourceText : undefined
    // Keep IDs/positions immutable through resume and provider repair rounds.
    if (prior) return prior
    const sourceText = await readSourceText(bytes, signal)
    if (region)
      sourceText.items = sourceText.items.filter(
        ({ bounds: b }) =>
          b.x + b.width / 2 >= region.x &&
          b.x + b.width / 2 <= region.x + region.width &&
          b.y + b.height / 2 >= region.y &&
          b.y + b.height / 2 <= region.y + region.height,
      )
    await db.begin(async (tx) => {
      await assertLease(tx, job)
      await tx`INSERT INTO analysis_passes(analysis_id,pass,proposal,usage) VALUES (${job.id},'read-source-text',${{ coordinatesVersion: 1, coordinateSystem: 'normalized-image-top-left', candidates: [], warnings: [], sourceText }}::jsonb,${{ local: true }}::jsonb) ON CONFLICT DO NOTHING`
    })
    return sourceText
  }
  const [measurements, sourceText] = await Promise.all([
    measureReconstructionSource(backend, bytes, region),
    text(),
  ])
  return { ...measurements!, sourceText }
}
export function withPlanContext(
  provider: PlanIntelligenceProvider,
  project: Project | undefined,
  levelId: string,
  sourceText?: SourceText,
): PlanIntelligenceProvider {
  const contextual = withLevelContext(provider, project, levelId)
  return {
    async interpret(input, signal) {
      const response = await contextual.interpret({ ...input, sourceText }, signal)
      return {
        ...response,
        proposal: {
          ...response.proposal,
          ...(sourceText ? { sourceText: structuredClone(sourceText) } : {}),
        },
      }
    },
  }
}
