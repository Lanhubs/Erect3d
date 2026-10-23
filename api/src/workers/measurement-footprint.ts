import type { Candidate, Intelligence } from '../contracts/analysis'
import { ApiError } from '../security/errors'
import { validateFootprint } from '../modules/plan-analysis/footprint-validation'

// A classification can confirm a measured line while correcting its alignment
// elsewhere in the proposal. Do not restore that raw line outside the source's
// building outline. Explicit interpreted geometry still passes full validation.
export function respectMeasurementFootprint(
  measured: Candidate[],
  proposals: Intelligence[],
  dimensions?: { width: number; height: number },
) {
  const source = proposals.find((proposal) => proposal.understanding?.footprint.length)
  if (!source || !dimensions) return measured
  const explicit = new Set(
    proposals
      .flatMap((proposal) => proposal.candidates)
      .filter((candidate) => candidate.kind === 'wall')
      .map((candidate) => candidate.id),
  )
  return measured.map((candidate) => {
    if (candidate.kind !== 'wall' || !/^cv_(wall|edge)_/.test(candidate.id) || explicit.has(candidate.id))
      return candidate
    try {
      validateFootprint(source, [candidate], dimensions.width, dimensions.height)
      return candidate
    } catch (error) {
      if (!(error instanceof ApiError) || error.code !== 'OUTSIDE_FOOTPRINT') return candidate
      return {
        ...candidate,
        kind: 'unknown' as const,
        needsReview: true as const,
        confidence: Math.min(0.35, candidate.confidence),
        uncertainties: [
          ...candidate.uncertainties,
          'Raw measurement conflicts with the interpreted building outline; retained as evidence, not erected.',
        ].slice(0, 20),
      }
    }
  })
}
