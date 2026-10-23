import type { Candidate, AnalysisJob, Intelligence } from '../../contracts/analysis'
import type { Project } from '../../contracts/project'
import type { DesignProposal } from '../../contracts/design'
import { ApiError } from '../../security/errors'
import { buildReconstruction } from './reconstruction'
import { validateCorrections } from './corrections'
import { modelQuality } from './quality'
import { applyDesigns } from '../../../../client/src/intelligence/designCompletion'
import { ProposalError } from '../../../../client/src/intelligence/errors'
import { validateGeometry } from '../projects/geometry-validation'
export function reviewModel(
  project: Project,
  input: AnalysisJob,
  analysisId: string,
  proposal: Intelligence,
  candidates: Candidate[],
  dimensions: { width: number; height: number },
  designs: DesignProposal[],
  allowed: string[],
  replaceLevel: boolean,
  revision: number,
) {
  const rebuilding = input.options.purpose === 'rebuild'
  if ((rebuilding || designs.length) && input.context?.revision !== revision)
    throw new ApiError(409, 'ENHANCEMENT_STALE', 'The model changed since analysis; request a fresh review')
  let document =
    candidates.length || rebuilding
      ? buildReconstruction(project, input, analysisId, proposal, candidates, dimensions, replaceLevel)
      : structuredClone(project)
  if (!rebuilding) validateCorrections(project, document, input, candidates, allowed)
  if (designs.length) {
    try {
      document = applyDesigns(document, input.levelId, designs)
    } catch (error) {
      if (error instanceof ProposalError) throw new ApiError(error.status, error.code, error.message)
      throw error
    }
  }
  validateGeometry(document)
  return {
    document,
    quality: modelQuality(
      proposal,
      document,
      input.levelId,
      input.calibration.method === 'manual',
      dimensions,
      ['full', 'fixtures', 'furniture'].includes(input.options.mode),
    ),
  }
}
