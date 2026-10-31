import type { Level, Project } from '../domain/types'
import { levelBoundsPoints } from '../geometry/elementBounds'
import { layersUsed, retag } from './layers'
import { assertWithinBudget, levelPlacements, lift, type CadPlacement } from './sceneLevels'
import { structureEntities } from './sceneStructure'
import { roomEntities } from './sceneRooms'
import { wallEntities } from './sceneWalls'
import { sceneBounds, type CadEntity, type CadScene } from './types'

/** Labels scale with the floor they sit on, so a studio and a stadium both read. */
function labelHeight(level: Level, levels: Level[]) {
  const points = levelBoundsPoints(level, levels)
  if (points.length < 2) return 0.25
  const xs = points.map((point) => point.x),
    zs = points.map((point) => point.z),
    diagonal = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs))
  return Math.min(0.5, Math.max(0.12, diagonal / 70))
}

function placementEntities(placement: CadPlacement): CadEntity[] {
  const level = placement.level
  return [
    ...structureEntities(level, placement.levels),
    ...wallEntities(level),
    ...roomEntities(level, labelHeight(level, placement.levels)),
  ]
}

export type CadSceneOptions = { levelId?: string; allLevels?: boolean }

/** The drawing a floor plan becomes: every placed entity, tagged, stacked and counted. */
export function buildCadScene(project: Project, options: CadSceneOptions = {}): CadScene {
  const entities = assertWithinBudget(
    levelPlacements(project, options).flatMap((placement) =>
      retag(lift(placementEntities(placement), placement.elevation), placement.suffix),
    ),
  )
  if (!entities.length) throw new Error('This floor has nothing to draw yet. Add walls or rooms first.')
  return { entities, layers: layersUsed(entities), bounds: sceneBounds(entities) }
}
