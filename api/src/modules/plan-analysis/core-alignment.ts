import type { Intelligence } from '../../contracts/analysis'
import type { Building, Point } from '../../contracts/project'

// A unique lift is not enough evidence when another independently identified
// circulation core contradicts its translation. Do not distort or rotate floors
// to conceal bad source coordinates or inconsistent dimensions.
export function conflictingCoreAlignment(
  building: Building,
  referenceLevelId: string,
  proposal: Intelligence,
  dimensions: { width: number; height: number },
  calibration: { a: Point; metresPerPixel: number },
) {
  const sources =
    proposal.architecturalRequirements?.systems.filter(
      (system) => system.kind === 'spiral-stair' && system.origin === 'detected',
    ) || []
  const references =
    building.systems?.systems.filter(
      (system) =>
        system.kind === 'spiral-stair' &&
        system.levelId === referenceLevelId &&
        system.visible !== false &&
        system.origin !== 'design-proposal',
    ) || []
  if (sources.length !== 1 || references.length !== 1) return false
  const boundary = proposal.candidates.find((candidate) => candidate.id === sources[0].boundaryId)
  const reference = references[0]
  if (!boundary?.curve || boundary.confidence < 0.7 || reference.kind !== 'spiral-stair') return false
  const x = (boundary.curve.center.x * dimensions.width - calibration.a.x) * calibration.metresPerPixel,
    z = (boundary.curve.center.y * dimensions.height - calibration.a.z) * calibration.metresPerPixel
  const tolerance = Math.max(
    0.35,
    Math.min(reference.radius, boundary.curve.radius * dimensions.width * calibration.metresPerPixel) * 0.2,
  )
  return Math.hypot(reference.center.x - x, reference.center.z - z) > tolerance
}
