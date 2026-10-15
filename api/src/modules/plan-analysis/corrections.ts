import type { Candidate, AnalysisJob } from '../../contracts/analysis'
import type { Project } from '../../contracts/project'
import { modelEntities } from '../../../../client/src/intelligence/provenance'
import { checksum } from '../../security/tokens'
import { ApiError } from '../../security/errors'
export function validateCorrections(before: Project, after: Project, input: AnalysisJob, chosen: Candidate[], allowed: string[]) {
  const previous = new Map(modelEntities(before).map(entity => [entity.id, entity])), next = new Map(modelEntities(after).map(entity => [entity.id, entity]))
  for (const candidate of chosen.filter(item => item.targetId)) {
    const id = candidate.targetId!, old = previous.get(id), updated = next.get(id)
    if (!old || (candidate.action==='remove'?Boolean(updated):!updated) || input.context?.hashes[id] !== checksum(old)) throw new ApiError(409,'ENHANCEMENT_STALE','A correction target changed since analysis; request fresh enhancement')
    const confirmed = before.interpretation?.[id]?.confirmedFields || Object.keys(old).filter(field => field !== 'id')
    const changes = candidate.action==='remove'?confirmed:confirmed.filter(field => JSON.stringify((old as unknown as Record<string, unknown>)[field]) !== JSON.stringify((updated as unknown as Record<string, unknown>)[field]))
    if (changes.length && !allowed.includes(candidate.id)) throw new ApiError(422,'CONFIRMED_FIELDS_PROTECTED',
      'Explicitly approve corrections to your confirmed fields before acceptance', { candidateId: candidate.id, fields: changes })
  }
}
