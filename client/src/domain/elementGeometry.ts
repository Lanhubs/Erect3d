import type { Building, Level, Point, Selection } from './types'
import { atWall } from '../geometry/math'
import { stairOpening } from '../geometry/stairs'

export function selectedElement(building: Building, selection: Selection) {
  if (!selection) return null
  if (selection.kind === 'fence') return building.siteFence?.id === selection.id
    ? { level: building.levels[0], element: building.siteFence, points: building.siteFence.boundary || [], height: building.siteFence.height } : null
  for (const level of building.levels) {
    const collections = { wall: level.walls, door: level.doors, window: level.windows, passage: level.passages,
      room: level.rooms, slab: level.slabs, column: level.columns, stair: level.stairs, ramp: level.ramps,
      seating: level.seatingSections, detail: level.details, furniture: level.furniture }
    const element = collections[selection.kind]?.find(item => item.id === selection.id)
    if (!element) continue
    let points: Point[] = [], height = .08
    if ('wallId' in element) {
      const wall = level.walls.find(item => item.id === element.wallId)
      if (!wall) return null
      points = [atWall(wall, element.offset), atWall(wall, element.offset + element.width)]
      height = 'sill' in element ? element.sill : .1
    } else if ('polygon' in element) { points = element.polygon; height = 'elevation' in element ? element.elevation : .04 }
    else if ('position' in element) { points = [element.position]; height = element.height / 2 }
    else if (selection.kind === 'stair') { points = stairOpening(element as NonNullable<Level['stairs']>[number], building.levels); height = .1 }
    else if ('start' in element && 'end' in element) {
      points = [element.start, element.end]
      height = 'height' in element ? element.height / 2 : 'startElevation' in element ? element.startElevation : .1
      if ('baseElevation' in element) height += element.baseElevation
    }
    return { level, element, points, height }
  }
  return null
}
export const pointsCenter = (points: Point[]): Point => ({
  x: points.reduce((sum, p) => sum + p.x, 0) / Math.max(1, points.length),
  z: points.reduce((sum, p) => sum + p.z, 0) / Math.max(1, points.length),
})
export type ElementChange = { move?: Point; vertex?: { index: number; point: Point }; rotate?: number; scale?: number; height?: number }
export const canRotate = (selection: Selection) => !!selection && !['door', 'window', 'passage'].includes(selection.kind)
export const canAdjustHeight = (selection: Selection) => !!selection && selection.kind !== 'stair'
