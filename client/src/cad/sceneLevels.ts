import type { TypicalFloorGroup } from '../domain/buildingSystems'
import type { Building, Level, Project } from '../domain/types'
import { linkedFloorIndices, typicalFloorElevation } from '../domain/typicalFloors'
import type { CadEntity, CadPoint } from './types'

/** Keeps a hand-off sheet openable: past this the export asks the user to narrow the scope. */
export const maxCadEntities = 60000

export type CadPlacement = {
  level: Level
  /** Every level of the owning building: stair rises are measured across them. */
  levels: Level[]
  elevation: number
  /** Empty for a single floor; `L1`, `L2`… spread every layer name when stacking storeys. */
  suffix: string
}

/** A typical-floor template stands for each linked repeat, one placement per elevation. */
function repeats(building: Building, level: Level) {
  const groups = (building.systems?.systems || []).filter(
    (system): system is TypicalFloorGroup =>
      system.kind === 'typical-floors' && system.templateLevelId === level.id,
  )
  const linked = groups.flatMap((group) =>
    linkedFloorIndices(building, group).map((index) => typicalFloorElevation(building, group, index)),
  )
  return linked.length ? linked : [level.elevation]
}

/** Which floors reach the drawing: one level, or every authored and linked storey. */
export function levelPlacements(
  project: Project,
  options: { levelId?: string; allLevels?: boolean } = {},
): CadPlacement[] {
  const building = project.buildings[0]
  if (!building) throw new Error('This project has no building to export.')
  if (!options.allLevels) {
    const level = building.levels.find((item) => item.id === options.levelId) || building.levels[0]
    if (!level) throw new Error('This building has no floor to export.')
    return [{ level, levels: building.levels, elevation: 0, suffix: '' }]
  }
  const placements = building.levels
    .flatMap((level) =>
      repeats(building, level).map((elevation) => ({ level, levels: building.levels, elevation })),
    )
    .sort((a, b) => a.elevation - b.elevation)
  return placements.map((placement, index) => ({ ...placement, suffix: `L${index + 1}` }))
}

/** Every storey keeps its authored height so a multi-level sheet stacks in 3D. */
export function lift(entities: CadEntity[], elevation: number): CadEntity[] {
  if (!Number.isFinite(elevation) || Math.abs(elevation) < 1e-6) return entities
  const raise = (point: CadPoint): CadPoint => ({ ...point, z: elevation })
  return entities.map((entity) => {
    if (entity.kind === 'polyline') return { ...entity, points: entity.points.map(raise) }
    if (entity.kind === 'line') return { ...entity, a: raise(entity.a), b: raise(entity.b) }
    if (entity.kind === 'text') return { ...entity, at: raise(entity.at) }
    return { ...entity, center: raise(entity.center) }
  })
}

export function assertWithinBudget(entities: CadEntity[], limit = maxCadEntities) {
  if (entities.length <= limit) return entities
  throw new Error(
    `This design has ${entities.length} CAD entities, over the ${limit} limit. Export one floor at a time or simplify the model.`,
  )
}
