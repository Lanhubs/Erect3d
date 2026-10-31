import { architecturalBounds } from '../geometry/systemCompiler'
import { wallBoundsPoints } from '../geometry/math'
import type { Building } from '../domain/types'

/** Camera and section-slider limits for the whole building. */
export function viewerBounds(building: Building) {
  const heights = building.levels.map((item) => item.elevation + (item.floorToFloorHeight || 3))
  const xPoints = building.levels.flatMap((item) => wallBoundsPoints(item.walls).map((point) => point.x))
  return {
    maxHeight: Math.max(5, ...heights, architecturalBounds(building).top),
    maxX: Math.max(8, ...xPoints),
    minX: Math.min(0, ...xPoints),
  }
}

export function sportsCategory(building: Building) {
  if (building.levels.some((item) => item.rooms.some((room) => room.category === 'football-pitch')))
    return 'stadium'
  if (
    building.levels.some((item) =>
      item.rooms.some(
        (room) => room.category === 'table-tennis-hall' || room.category === 'basketball-court',
      ),
    )
  )
    return 'arena'
  return null
}
