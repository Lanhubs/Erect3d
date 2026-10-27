import type { Project } from '../../contracts/project'
import type { PlanIntelligenceProvider } from './provider'

export function reconstructionLevelContext(project: Project, levelId: string) {
  const building = project.buildings.find((building) => building.levels.some((level) => level.id === levelId))
  const target = building?.levels.find((level) => level.id === levelId)
  if (!building || !target) return undefined
  const describe = (level: typeof target) => ({
    id: level.id,
    name: level.name,
    elevationMetres: level.elevation,
    floorHeightMetres: level.floorToFloorHeight,
    slabThicknessMetres: level.slabThickness,
    hasSeparateSource: !!level.sourceId && level.sourceId !== target.sourceId,
    modelled: level.walls.length > 0,
    circulation: building.systems?.systems
      .filter(
        (system) =>
          system.levelId === level.id && ['shaft', 'core', 'spiral-stair', 'void'].includes(system.kind),
      )
      .slice(0, 12)
      .map((system) => ({
        kind: system.kind,
        name: system.name,
        elevationMetres: system.elevation,
        ...('polygon' in system ? { polygonMetres: system.polygon.slice(0, 32) } : {}),
        ...('center' in system ? { centerMetres: system.center } : {}),
      })),
  })
  return {
    selected: describe(target),
    related: building.levels
      .filter((level) => level.id !== levelId)
      .toSorted((a, b) => Math.abs(a.elevation - target.elevation) - Math.abs(b.elevation - target.elevation))
      .slice(0, 32)
      .map(describe),
    note: 'Saved model context in METRES, not normalized image coordinates. Reconstruct ONLY the selected source floor. Different floor sources are distinct layouts, never proof of repetition. System elevations are floor-relative: an upper-floor balcony normally has elevation 0. Do not shift other floors or assume that their image origins align. Use circulation context to flag inconsistent connections for review, never to superimpose their geometry.',
  }
}
export type ReconstructionLevelContext = ReturnType<typeof reconstructionLevelContext>
export function withLevelContext(
  provider: PlanIntelligenceProvider,
  project: Project | undefined,
  levelId: string,
): PlanIntelligenceProvider {
  if (!project) return provider
  const levelContext = reconstructionLevelContext(project, levelId)
  return { interpret: (source, signal) => provider.interpret({ ...source, levelContext }, signal) }
}
