import type { Intelligence, Candidate } from '../contracts/analysis'
export function guardMeasurementAudit(
  proposal: Intelligence,
  measured: Candidate[],
  baseline?: Intelligence,
) {
  const protectedIds = new Set(
    baseline?.candidates.filter((item) => item.kind !== 'unknown').map((item) => item.id),
  )
  const allowed = new Set(
    measured
      .filter((item) => item.id.startsWith('cv_edge_') && !protectedIds.has(item.id))
      .map((item) => item.id),
  )
  const dispositions = (proposal.dispositions || []).filter((item) => allowed.has(item.candidateId))
  return {
    coordinatesVersion: 1 as const,
    coordinateSystem: 'normalized-image-top-left' as const,
    candidates: [],
    dispositions,
    warnings: [
      ...proposal.warnings,
      ...(proposal.candidates.length || dispositions.length !== (proposal.dispositions || []).length
        ? [
            'The fine-line audit cannot remove or redraw the established model; only measured stroke classifications were used.',
          ]
        : []),
    ].slice(0, 100),
  }
}
