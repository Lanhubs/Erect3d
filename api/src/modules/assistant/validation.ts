import type { Project } from '../../contracts/project'
import { ApiError } from '../../security/errors'
import { validFootprint } from '../../../../client/src/domain/elementEditing'
import { containsPolygon } from '../../../../client/src/geometry/polygons'
import { stairPlacementValid } from '../../../../client/src/geometry/stairPlacement'
// Preserve pre-existing geometry, but require edited footprints and affected stairs to fit.
export function validateEdits(before: Project, after: Project) {
  for (const building of after.buildings) {
    const original = before.buildings.find((b) => b.id === building.id)
    for (const level of building.levels) {
      const previous = original?.levels.find((l) => l.id === level.id)
      for (const item of [...level.rooms, ...(level.slabs || [])]) {
        const old = [...(previous?.rooms || []), ...(previous?.slabs || [])].find((e) => e.id === item.id)
        if (JSON.stringify(item) === JSON.stringify(old)) continue
        if (!validFootprint(item.polygon))
          throw new ApiError(422, 'ASSISTANT_GEOMETRY', 'Keep clear footprint edges without crossings')
        if ('openings' in item)
          for (const opening of item.openings)
            if (!validFootprint(opening.polygon) || !containsPolygon(item.polygon, opening.polygon))
              throw new ApiError(422, 'ASSISTANT_GEOMETRY', 'Keep a valid floor opening inside its slab')
      }
      for (const stair of level.stairs || []) {
        const upper = building.levels.find((l) => l.id === stair.toLevelId),
          old = previous?.stairs?.find((s) => s.id === stair.id),
          oldUpper = original?.levels.find((l) => l.id === stair.toLevelId)
        if (
          !stairPlacementValid(stair, building.levels, upper?.slabs || []) &&
          (!old ||
            JSON.stringify(stair) !== JSON.stringify(old) ||
            stairPlacementValid(old, original!.levels, oldUpper?.slabs || []))
        )
          throw new ApiError(
            422,
            'ASSISTANT_GEOMETRY',
            'Keep connected stairs clear of walls and inside the upper slab',
          )
      }
    }
  }
}
