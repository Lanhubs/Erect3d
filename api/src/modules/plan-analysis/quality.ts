import type { Candidate, Intelligence } from '../../contracts/analysis'
import type { Project } from '../../contracts/project'
import { furnitureTypes } from '../../../../client/src/furniture/types'
import { sourceCoverage } from './source-coverage'
import { openingCoverage } from './opening-coverage'
import { fixtureCoverage } from './fixture-coverage'
export type ModelQuality = {
  status: 'ready' | 'needs-review' | 'blocked'
  issues: { code: string; severity: 'warning' | 'error'; message: string; candidateId?: string }[]
}
export function modelQuality(
  proposal: Intelligence,
  project?: Project,
  levelId?: string,
  manualScale = false,
  dimensions?: { width: number; height: number },
  reviewFixtures = false,
): ModelQuality {
  const issues: ModelQuality['issues'] = []
  const add = (code: string, message: string, candidateId?: string) =>
    issues.push({ code, severity: 'warning', message, candidateId })
  const unknown = proposal.candidates.filter((item) => item.kind === 'unknown').length
  for (const system of proposal.architecturalRequirements?.systems || [])
    if (
      system.kind === 'typical-floors' &&
      (!system.layoutEvidence?.matchesTemplate ||
        system.layoutEvidence.levelNames.length < system.parameters.count)
    )
      add(
        'REPEATED_LAYOUT_UNVERIFIED',
        'Floor labels establish storeys, not matching layouts. This repetition stays an optional proposal until the template match is established.',
      )
  if (unknown) add('UNCLASSIFIED', `${unknown} source measurements need interpretation before inclusion.`)
  for (const item of proposal.candidates) {
    if (item.kind === 'unknown') continue
    if (item.kind === 'passage' && !item.wallId)
      add(
        'OPEN_CIRCULATION',
        'This circulation route has no enclosing wall and remains open. Its source guide is retained.',
        item.id,
      )
    if (
      item.kind === 'furniture' &&
      !furnitureTypes.some((type) => type === item.furnitureType && type !== 'unknown')
    )
      add(
        'UNSUPPORTED_FIXTURE',
        'Choose a supported editable asset for this fixture; its source detection is retained.',
        item.id,
      )
    if (item.confidence < 0.5)
      add('UNCERTAIN_GEOMETRY', 'Verify this geometry against the source; confidence is low.', item.id)
    if (item.kind === 'stair' && !item.targetLevelId)
      add('STAIR_CONNECTION', 'A stair footprint is a guide until its upper floor is confirmed.', item.id)
    if (item.kind === 'stair' && item.points.length < 3)
      add(
        'INCOMPLETE_STAIR_GUIDE',
        'This stair detection has no footprint polygon. Its source evidence is retained without erecting a stair.',
        item.id,
      )
  }
  const level = project?.buildings.flatMap((item) => item.levels).find((item) => item.id === levelId)
  if (
    !manualScale &&
    level?.calibration?.method !== 'manual' &&
    proposal.understanding?.scale?.origin !== 'annotated'
  )
    add(
      'PROVISIONAL_SCALE',
      'No readable absolute dimension was established. Scale remains an estimate unless you supply a known measurement.',
    )
  if (level && !level.doors.length)
    add('NO_DOORS', 'No door was established; review entrances before accepting the house.')
  if (level && !level.windows.length)
    add('NO_WINDOWS', 'No window was established; check the source for frames and glazing.')
  if (level && !level.rooms.length)
    add(
      'NO_ROOMS',
      'The wall network has no enclosed spaces. Review joins or room polygons before accepting.',
    )
  if (project && levelId)
    issues.push(...sourceCoverage(proposal, project, levelId, manualScale ? undefined : dimensions))
  if (project && levelId) issues.push(...openingCoverage(proposal, project, levelId, dimensions))
  if (project && levelId && reviewFixtures) issues.push(...fixtureCoverage(project, levelId))
  return { status: issues.length ? 'needs-review' : 'ready', issues: issues.slice(0, 100) }
}
export const buildableCandidates = (candidates: Candidate[]) =>
  candidates.filter(
    (item) =>
      item.kind !== 'unknown' &&
      (item.kind !== 'stair' || item.points.length >= 3) &&
      (item.kind !== 'passage' || item.wallId) &&
      (item.kind !== 'furniture' ||
        furnitureTypes.some((type) => type === item.furnitureType && type !== 'unknown')),
  )
