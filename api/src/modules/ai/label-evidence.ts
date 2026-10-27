import type { Intelligence } from '../../contracts/analysis'
export function mergeLabelEvidence(proposals: Intelligence[]) {
  const sourceText = proposals.find((proposal) => proposal.sourceText)?.sourceText
  const labelReadings = [
    ...new Map(
      proposals
        .flatMap((proposal) => proposal.labelReadings || [])
        .map((reading) => [reading.sourceId, reading]),
    ).values(),
  ]
  return { ...(sourceText ? { sourceText } : {}), ...(labelReadings.length ? { labelReadings } : {}) }
}
