import type { AnalysisInput, Intelligence } from '../../contracts/analysis'
import type { Project, Point } from '../../contracts/project'
import { reconstructionScale } from './reconstruction-scale'
import { conflictingCoreAlignment } from './core-alignment'

// Translation only. Never guess rotation, resize a floor, or replace a manual offset.
export function reconstructionPlacement(
  project: Project,
  input: AnalysisInput,
  proposal: Intelligence,
  dimensions: { width: number; height: number },
) {
  const effective = reconstructionScale(input, proposal, dimensions.width, dimensions.height)
  if (
    input.options.purpose !== 'rebuild' ||
    input.calibration.method === 'manual' ||
    input.alignment !== undefined
  )
    return { input: effective }
  const building = project.buildings.find((building) =>
    building.levels.some((level) => level.id === input.levelId),
  )
  const target = building?.levels.find((level) => level.id === input.levelId)
  if (!building || !target || target.alignment !== undefined) return { input: effective }
  for (const kind of ['shaft', 'spiral-stair'] as const) {
    const sources =
      proposal.architecturalRequirements?.systems.filter(
        (system) =>
          system.kind === kind &&
          system.origin === 'detected' &&
          (kind !== 'shaft' || /elev|elvt|lift/i.test(`${system.name} ${system.evidence}`)),
      ) || []
    if (sources.length !== 1) continue
    const source = sources[0],
      boundary = proposal.candidates.find((candidate) => candidate.id === source.boundaryId)
    if (!boundary || boundary.confidence < 0.7 || boundary.points.length < 2) continue
    const sourcePoint = boundary.curve?.center || {
      x:
        (Math.min(...boundary.points.map((point) => point.x)) +
          Math.max(...boundary.points.map((point) => point.x))) /
        2,
      y:
        (Math.min(...boundary.points.map((point) => point.y)) +
          Math.max(...boundary.points.map((point) => point.y))) /
        2,
    }
    const references = building.levels
      .filter(
        (level) =>
          level.id !== target.id &&
          level.sourceId &&
          level.sourceId !== target.sourceId &&
          level.walls.length,
      )
      .toSorted((a, b) => Math.abs(a.elevation - target.elevation) - Math.abs(b.elevation - target.elevation))
    for (const floor of references) {
      const matches =
        building.systems?.systems.filter(
          (system) =>
            system.kind === kind &&
            system.levelId === floor.id &&
            system.visible !== false &&
            system.origin !== 'design-proposal' &&
            (kind !== 'shaft' || /elev|elvt|lift/i.test(`${system.name} ${system.evidence || ''}`)),
        ) || []
      if (matches.length !== 1) continue
      const reference = matches[0]
      let centre: Point
      if (reference.kind === 'spiral-stair') centre = reference.center
      else if (reference.kind === 'shaft')
        centre = {
          x:
            (Math.min(...reference.polygon.map((point) => point.x)) +
              Math.max(...reference.polygon.map((point) => point.x))) /
            2,
          z:
            (Math.min(...reference.polygon.map((point) => point.z)) +
              Math.max(...reference.polygon.map((point) => point.z))) /
            2,
        }
      else continue
      const calibration = effective.calibration
      const span = Math.hypot(calibration.b.x - calibration.a.x, calibration.b.z - calibration.a.z)
      const a = {
        x: sourcePoint.x * dimensions.width - centre.x / calibration.metresPerPixel,
        z: sourcePoint.y * dimensions.height - centre.z / calibration.metresPerPixel,
      }
      const aligned = { ...calibration, a, b: { x: a.x + span, z: a.z } }
      if (kind === 'shaft' && conflictingCoreAlignment(building, floor.id, proposal, dimensions, aligned))
        return {
          input: effective,
          note: `Automatic alignment was withheld: the lift and circular stair disagree with ${floor.name}. Review source core positions and scale; no floor was moved or stretched to hide the conflict.`,
        }
      effective.calibration = aligned
      return {
        input: effective,
        note: `This floor was aligned by its unique ${kind === 'shaft' ? 'lift shaft' : 'circular stair'} to ${floor.name}. Review circulation alignment and scale before applying.`,
      }
    }
  }
  return { input: effective }
}
