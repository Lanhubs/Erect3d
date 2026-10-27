import type { Intelligence, Candidate } from '../contracts/analysis'
export function labelRepairTargets(proposal: Intelligence, ids: Set<string | undefined>): Candidate[] {
  return (proposal.sourceText?.items || [])
    .filter((label) => ids.has(label.id))
    .map((label) => {
      const b = label.bounds
      return {
        id: label.id,
        kind: 'unknown',
        label: label.text,
        points: [
          { x: b.x, y: b.y },
          { x: b.x + b.width, y: b.y },
          { x: b.x + b.width, y: b.y + b.height },
          { x: b.x, y: b.y + b.height },
        ],
        confidence: label.confidence,
        evidence:
          'Local OCR text location only; this box is NOT architectural geometry. Return actual source area geometry with a separate ID and link labelReadings.',
        uncertainties: [],
        needsReview: true,
      }
    })
}
