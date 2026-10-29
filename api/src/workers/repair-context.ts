import type { Candidate, Intelligence } from '../contracts/analysis'
import type { IntelligenceInput } from '../modules/ai/provider'
import type { ModelQuality } from '../modules/plan-analysis/quality'
import { labelRepairTargets } from './label-targets'
import { spaceRepairTargets } from './space-targets'
const coverageCodes = [
  'UNASSIGNED_ENCLOSURE',
  'SOURCE_LABEL_UNACCOUNTED',
  'SOURCE_SPACE_UNMODELED',
  'SOURCE_SPACE_MISNAMED',
  'SOURCE_LABEL_AS_GEOMETRY',
  'SOURCE_TEXT_UNCLEAR',
  'NO_WINDOWS',
  'NO_DOORS',
  'ROOM_NO_ACCESS',
  'SCALE_REFERENCE_INTERIOR',
  'EXTERIOR_ROOM_OPENINGS_UNCHECKED',
  'ROOM_FIXTURES_UNCHECKED',
]
export const needsSourceRepair = (quality: ModelQuality) =>
  quality.status === 'blocked' || quality.issues.some((issue) => coverageCodes.includes(issue.code))
// Repairs are sparse edits. Limit context to failed entities, their hosts and
// nearby source geometry instead of asking the provider to redraw the building.
export function repairContext(
  source: IntelligenceInput,
  proposal: Intelligence,
  quality: ModelQuality,
): IntelligenceInput {
  // Resolve invalid geometry before asking for a broad fixture/facade audit.
  // Mixing both tasks made the bounded repair redraw rooms while leaving the
  // exact invalid opening unchanged.
  const blocked = quality.issues.some((issue) => issue.severity === 'error')
  const relevant = quality.issues.filter(
    (issue) => issue.severity === 'error' || (!blocked && coverageCodes.includes(issue.code)),
  )
  const coverage = !blocked && relevant.some((issue) => coverageCodes.includes(issue.code))
  const failed = new Set(relevant.map((issue) => issue.candidateId).filter(Boolean))
  const targets = [
    ...proposal.candidates.filter((candidate) => failed.has(candidate.id)),
    ...labelRepairTargets(proposal, failed),
    ...spaceRepairTargets(quality),
  ]
  const anchors = targets.flatMap((candidate) => candidate.points)
  const hosts = new Set(targets.map((candidate) => candidate.wallId).filter(Boolean))
  const distance = (candidate: Candidate) =>
    Math.min(
      Infinity,
      ...candidate.points.flatMap((point) =>
        anchors.map((anchor) => Math.hypot(point.x - anchor.x, point.y - anchor.y)),
      ),
    )
  const nearby = proposal.candidates
    .filter((candidate) => !failed.has(candidate.id))
    .sort((a, b) => Number(hosts.has(b.id)) - Number(hosts.has(a.id)) || distance(a) - distance(b))
    .slice(0, coverage ? 240 : 80)
  const needsDocument = quality.issues.some(
    (issue) => issue.severity === 'error' && /ARCHITECTURE|HEIGHT|FLOOR_DIMENSION/.test(issue.code),
  )
  return {
    ...source,
    document: needsDocument ? source.document : undefined,
    designReference: undefined,
    candidates: [...targets, ...nearby],
    understanding: proposal.understanding,
    labelReadings: proposal.labelReadings?.filter((reading) => failed.has(reading.sourceId)),
    architecturalRequirements: proposal.architecturalRequirements,
    details: coverage
      ? source.details
      : source.details?.filter((detail) =>
          anchors.some(
            (anchor) =>
              anchor.x >= detail.region.x &&
              anchor.y >= detail.region.y &&
              anchor.x <= detail.region.x + detail.region.width &&
              anchor.y <= detail.region.y + detail.region.height,
          ),
        ),
    validationIssues: [
      ...relevant.map((issue) => `${issue.code}: ${issue.message}`),
      ...(coverage
        ? [
            'Audit the complete circulation: every enclosed bedroom, bathroom, closet, garage and service room needs its depicted entrance. Use the source swing/leaf and frame marks to distinguish doors, windows and open-plan boundaries. Correct the named rooms and dimension reference; keep existing candidate IDs for corrections. Inspect all facades, not just one. Do not add speculative doors or change walls solely to pass a check.',
          ]
        : []),
      ...(coverage && relevant.some((issue) => issue.code === 'ROOM_FIXTURES_UNCHECKED')
        ? [
            'Return every clearly depicted missing sofa, armchair, table, chair, cabinet, sink, toilet, shower or bath in the named rooms as furniture candidates. Use source footprint corners, furnitureRotation, and type-specific heights. This is source interpretation, not automatic furnishing: do not fill genuinely empty space or invent a furniture package.',
          ]
        : []),
      ...(coverage
        ? [
            'Inspect every exterior wall span for window/frame marks (including W labels) and real entrance gaps. Return all depicted missing windows/doors with exact existing wallId hosts and two points along each gap. Add a host only where source ink establishes one. Preserve existing geometry. If the drawing genuinely has no such openings, explain the source evidence in warnings; never invent openings to satisfy a count.',
          ]
        : []),
    ],
  }
}
