import type { Candidate } from '../contracts/analysis'
import type { ModelQuality } from '../modules/plan-analysis/quality'

export function spaceRepairTargets(quality: ModelQuality): Candidate[] {
  return quality.issues.flatMap((issue) => {
    const r = issue.sourceRegion
    if (!r || !issue.candidateId) return []
    return [
      {
        id: issue.candidateId,
        kind: 'unknown' as const,
        confidence: 0,
        needsReview: true,
        uncertainties: ['Unassigned region; interpret the original pixels before creating geometry.'],
        label: 'Unassigned source region — audit only',
        points: [
          { x: r.x, y: r.y },
          { x: r.x + r.width, y: r.y },
          { x: r.x + r.width, y: r.y + r.height },
          { x: r.x, y: r.y + r.height },
        ],
        evidence: issue.message,
      },
    ]
  })
}
