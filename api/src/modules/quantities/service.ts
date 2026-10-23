import type { Project } from '../../contracts/project'
import { buildingQuantities } from '../../../../client/src/geometry/quantities'
export function projectQuantities(document: Project) {
  return {
    units: 'metres',
    professionalBOQ: false,
    buildings: document.buildings.map((building) => {
      const { byLevel, ...totals } = buildingQuantities(building)
      return {
        buildingId: building.id,
        ...totals,
        levels: byLevel.map((item) => ({
          levelId: item.level.id,
          name: item.level.name,
          ...item.quantities,
        })),
      }
    }),
    schedules: document.buildings.flatMap((building) =>
      building.levels.map((level) => ({
        levelId: level.id,
        doors: level.doors,
        windows: level.windows,
        rooms: level.rooms.map((room) => ({ id: room.id, name: room.name, material: room.material })),
      })),
    ),
  }
}
