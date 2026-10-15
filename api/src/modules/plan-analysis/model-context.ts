import type { Project } from '../../contracts/project'
import type { AnalysisInput } from '../../contracts/analysis'
import { modelContext } from '../../../../client/src/intelligence/modelContext'
import { modelEntities } from '../../../../client/src/intelligence/provenance'
import { checksum } from '../../security/tokens'
export function captureContext(project: Project, input: AnalysisInput, revision: number, width: number, height: number) {
  const candidates = modelContext(project, input, width, height), ids = new Set(candidates.map(candidate => candidate.targetId))
  const hashes = Object.fromEntries(modelEntities(project).filter(entity => ids.has(entity.id)).map(entity => [entity.id, checksum(entity)]))
  return { revision, candidates, hashes }
}
