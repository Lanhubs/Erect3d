import { boundaryWallIds } from './system-wall-hosts'
import type { AnalysisInput, Candidate, Intelligence } from '../../contracts/analysis'
import type { Project } from '../../contracts/project'
import type { BuildingSystem } from '../../../../client/src/domain/buildingSystems'
import { systemSchema } from '../../contracts/architecture'
import { validateSystems } from '../../../../client/src/domain/systemValidation'
import { imageToWorld } from './conversion'
import { digest } from '../../security/tokens'
import { ApiError } from '../../security/errors'
import { sourceVoid } from './source-void'
export function applyArchitecturalSystems(
  project: Project,
  input: AnalysisInput,
  analysisId: string,
  proposal: Intelligence,
  candidates: Candidate[],
  dimensions: { width: number; height: number },
) {
  if (!proposal.architecturalRequirements) return
  const building = project.buildings.find((b) => b.levels.some((l) => l.id === input.levelId))!,
    level = building.levels.find((l) => l.id === input.levelId)!
  const systems: BuildingSystem[] = []
  for (const requirement of proposal.architecturalRequirements.systems) {
    const candidate = candidates.find((c) => c.id === requirement.boundaryId),
      p = requirement.parameters
    const points =
      candidate?.points.map((point) => imageToWorld(point, dimensions.width, dimensions.height, input)) || []
    const base = {
      id: `ai_${digest(`${analysisId}:system:${requirement.id}`).slice(0, 32)}`,
      name: requirement.name,
      levelId: level.id,
      origin: requirement.origin,
      evidence: requirement.evidence,
      assumptions: requirement.assumptions,
      visible: requirement.origin !== 'design-proposal',
      elevation: p.elevation || 0,
      color: '#899ba5',
    }
    if (input.options.designMode === 'faithful' && requirement.origin === 'inferred')
      throw new ApiError(
        422,
        'ARCHITECTURE_REVIEW_REQUIRED',
        `Review inferred architecture: ${requirement.name}`,
      )
    let system: unknown
    if (requirement.kind === 'typical-floors') {
      if (!p.count || !p.floorHeight)
        throw new ApiError(
          422,
          'ARCHITECTURE_DIMENSIONS_REQUIRED',
          'Repeated floors require an evidenced count and floor height.',
        )
      const matched =
        requirement.layoutEvidence?.matchesTemplate && requirement.layoutEvidence.levelNames.length >= p.count
      system = {
        ...base,
        kind: requirement.kind,
        layoutEvidence: requirement.layoutEvidence,
        templateLevelId: level.id,
        count: p.count,
        floorHeight: p.floorHeight,
        detached: {},
        ...(!matched
          ? {
              origin: 'design-proposal',
              visible: false,
              assumptions: [
                ...(base.assumptions || []).slice(0, 19),
                'Matching layouts for every repeated floor have not been established; review before including.',
              ],
            }
          : {}),
      }
    } else {
      if (!candidate || !p.height)
        throw new ApiError(
          422,
          'ARCHITECTURE_SOURCE_REQUIRED',
          `Review ${requirement.boundaryId}: ${requirement.name} requires its source boundary and parameters.height in metres.`,
        )
      if (requirement.kind === 'curtain-wall')
        system = {
          ...base,
          kind: requirement.kind,
          path: points,
          height: p.height,
          bayWidth: p.bayWidth || 1.5,
          transomHeight: p.transomHeight || 1.5,
          depth: p.depth || 0.12,
          ...(candidate.curve
            ? {
                curve: {
                  ...candidate.curve,
                  center: imageToWorld(candidate.curve.center, dimensions.width, dimensions.height, input),
                  radius: candidate.curve.radius * dimensions.width * input.calibration.metresPerPixel,
                },
              }
            : {}),
        }
      if (requirement.kind === 'beam')
        system = {
          ...base,
          kind: requirement.kind,
          start: points[0],
          end: points.at(-1),
          height: p.height,
          width: p.width || 0.25,
        }
      if (requirement.kind === 'core' || requirement.kind === 'shaft')
        system = {
          ...base,
          kind: requirement.kind,
          polygon: points,
          height: p.height,
          thickness: p.thickness || 0.2,
        }
      if (requirement.kind === 'void') system = sourceVoid(base, points, requirement, level.slabThickness)
      if (requirement.kind === 'massing')
        system = {
          ...base,
          kind: requirement.kind,
          polygon: points,
          holes: [],
          height: p.height,
          role: requirement.role || 'wing',
        }
      if (requirement.kind === 'spiral-stair') {
        const q = requirement.parameters,
          xs = points.map((v) => v.x),
          zs = points.map((v) => v.z),
          center = candidate.curve
            ? imageToWorld(candidate.curve.center, dimensions.width, dimensions.height, input)
            : { x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2 }
        const radius = candidate.curve
          ? candidate.curve.radius * dimensions.width * input.calibration.metresPerPixel
          : Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) / 2
        if (Math.abs(q.radius - radius) > Math.max(0.05, radius * 0.1) + 0.0001)
          throw new ApiError(
            422,
            'ARCHITECTURE_SOURCE_MISMATCH',
            `Review ${candidate.id}: spiral outer radius ${q.radius} m conflicts with the source outline's measured ${radius.toFixed(3)} m. Preserve the selected source circle and its measured radius; its anchor must trace the stair itself, excluding exit lobbies and landings.`,
          )
        system = {
          ...base,
          kind: requirement.kind,
          center,
          radius: q.radius,
          width: q.width,
          height: q.height,
          riserHeight: q.riserHeight,
          turnHeight: q.turnHeight,
          rotation: q.rotation || 0,
          clockwise: requirement.clockwise ?? true,
          material: requirement.material === 'concrete' ? 'concrete' : 'metal',
        }
      }
      if (requirement.kind === 'articulation') {
        if (!requirement.profile || !p.depth || !p.thickness || !p.spacing)
          throw new ApiError(
            422,
            'ARCHITECTURE_DIMENSIONS_REQUIRED',
            `${requirement.name} requires a profile, projection, section and spacing.`,
          )
        system = {
          ...base,
          kind: requirement.kind,
          repeatWithFloor: requirement.repeatWithFloor,
          profile: requirement.profile,
          material: requirement.material || 'concrete',
          side: requirement.side || 'left',
          path: points.slice(0, 2),
          ...(points.length >= 3 ? { footprint: points } : {}),
          height: p.height,
          depth: p.depth,
          thickness: p.thickness,
          spacing: p.spacing,
          ...(candidate.curve
            ? {
                curve: {
                  ...candidate.curve,
                  center: imageToWorld(candidate.curve.center, dimensions.width, dimensions.height, input),
                  radius: candidate.curve.radius * dimensions.width * input.calibration.metresPerPixel,
                },
              }
            : {}),
        }
      }
    }
    const result = systemSchema.safeParse(system)
    if (!result.success)
      throw new ApiError(
        422,
        'ARCHITECTURE_INVALID',
        `Review the architectural parameters for ${requirement.name}.`,
      )
    const entity = result.data
    if (entity.kind === 'core' || entity.kind === 'shaft' || entity.kind === 'curtain-wall') {
      const ids = boundaryWallIds(level.walls, points, entity.kind !== 'curtain-wall')
      if (ids.length) entity.wallIds = ids
    }
    systems.push(entity)
  }
  const preserved =
      building.systems?.systems.filter((s) => s.origin === 'user-selected' || s.levelId !== level.id) || [],
    preservedIds = new Set(preserved.map((s) => s.id))
  building.systems = {
    version: 1,
    typology: proposal.architecturalRequirements.typology,
    systems: [...preserved, ...systems.filter((s) => !preservedIds.has(s.id))],
  }
  const issues = validateSystems(building)
  if (issues.length) throw new ApiError(422, 'ARCHITECTURE_INVALID', issues.join(' · '))
}
