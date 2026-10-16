import type { Building, RoofSection } from './types'
import { effectiveRoofSections } from './roofCoverage'

export function createRoofGeometryCache() {
  let previous: unknown[] = [], sections: RoofSection[] = []
  return (building: Building) => {
    const inputs = [building.roof, building.roofSections, building.systems, ...building.levels.flatMap(level =>
      [level.id, level.elevation, level.autoRoof, level.roof, level.rooms, level.slabs, level.walls,level.columns])]
    if (inputs.length !== previous.length || inputs.some((value, i) => value !== previous[i])) {
      previous = inputs; sections = effectiveRoofSections(building)
    }
    return sections
  }
}
