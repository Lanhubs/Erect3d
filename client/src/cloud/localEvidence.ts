import { create } from 'zustand'
import type { Candidate } from '../../../api/src/contracts/analysis'
import type { Calibration, Point, Wall } from '../domain/types'
import type { PlanDetail } from '../domain/interpretationTypes'
import { findOpeningCandidates, type WorldFeature } from '../geometry/openingCandidates'
import { assembleDraft } from '../geometry/reconstruct'
import { enclosedSpaces } from '../geometry/roomTopology'
type Evidence = { sourceId: string; calibration: Calibration; candidates: Candidate[] }
export const useLocalEvidence = create<{ evidence?: Evidence }>(() => ({}))
export const sameEvidenceScale = (a?: Calibration, b?: Calibration) => Boolean(a && b &&
  JSON.stringify([a.a,a.b,a.knownMetres,a.metresPerPixel]) === JSON.stringify([b.a,b.b,b.knownMetres,b.metresPerPixel]))
export function publishLocalEvidence(sourceId: string, dimensions: { width: number; height: number }, calibration: Calibration,
  walls: Wall[], features: WorldFeature[], details: PlanDetail[]) {
  const pixelWidth = dimensions.width * calibration.metresPerPixel, pixelHeight = dimensions.height * calibration.metresPerPixel
  const point = (p: Point) => ({ x: (p.x + calibration.a.x * calibration.metresPerPixel) / pixelWidth,
    y: (p.z + calibration.a.z * calibration.metresPerPixel) / pixelHeight })
  const valid = (points: Candidate['points']) => points.every(p => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1)
  const openings = findOpeningCandidates(walls, features), draft = assembleDraft(walls, openings)
  const base = { confidence: .65, evidence: 'OpenCV geometric measurement; architectural meaning needs review', uncertainties: [], needsReview: true as const }
  const candidates: Candidate[] = draft.walls.map(wall => ({ ...base, id: wall.id, kind: 'wall',
    points: [point(wall.start), point(wall.end)], thickness: wall.thickness / pixelWidth }))
  for (const opening of [...draft.doors, ...draft.windows, ...draft.passages]) {
    const wall = draft.walls.find(w => w.id === opening.wallId)!
    const length = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z)
    const along = (offset: number) => point({ x: wall.start.x + (wall.end.x - wall.start.x) * offset / length,
      z: wall.start.z + (wall.end.z - wall.start.z) * offset / length })
    candidates.push({ ...base, id: opening.id, kind: 'hinge' in opening ? 'door' : 'sill' in opening ? 'window' : 'passage', wallId: wall.id,
      points: [along(opening.offset), along(opening.offset + opening.width)], evidence: 'OpenCV gap and thin line/swing evidence' })
  }
  details.forEach(detail => candidates.push({ ...base, id: detail.id, kind: detail.kind, points: detail.polygon.map(point),
    confidence: detail.confidence, evidence: detail.evidence }))
  enclosedSpaces(draft.walls).forEach((polygon, index) => candidates.push({ ...base, id: `opencv_room_${index}`,
    kind: 'room', points: polygon.map(point), evidence: 'Enclosed polygon derived deterministically from the detected wall network' }))
  features.slice(0, 200).forEach((feature, index) => candidates.push({ ...base, id: `opencv_feature_${index}`, kind: 'unknown',
    points: [point(feature.start), point(feature.end)], evidence: `OpenCV thin ${feature.kind} feature; distinguish door leaf, frame and annotation` }))
  useLocalEvidence.setState({ evidence: { sourceId, calibration,
    candidates: candidates.filter(candidate => valid(candidate.points) && (!candidate.thickness || candidate.thickness <= .1)).slice(0, 2000) } })
}
