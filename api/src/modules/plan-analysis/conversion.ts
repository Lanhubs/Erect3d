import type { Candidate, AnalysisInput } from '../../contracts/analysis'
import type { Project } from '../../contracts/project'
import { digest } from '../../security/tokens'
import { ApiError } from '../../security/errors'
import { convertProposal } from '../../../../client/src/intelligence/convertProposal'
import { ProposalError } from '../../../../client/src/intelligence/errors'
export { imageToWorld } from '../../../../client/src/intelligence/convertProposal'
export function convertCandidates(
  project: Project,
  input: AnalysisInput,
  analysisId: string,
  candidates: Candidate[],
  dimensions: { width: number; height: number },
) {
  try {
    return convertProposal(
      project,
      input,
      analysisId,
      candidates,
      dimensions,
      (id, suffix) => `ai_${digest(`${analysisId}:${id}:${suffix}`).slice(0, 32)}`,
    )
  } catch (error) {
    if (error instanceof ProposalError) throw new ApiError(error.status, error.code, error.message)
    throw error
  }
}
