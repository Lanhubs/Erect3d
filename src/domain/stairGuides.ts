import type { Project, Stair } from './types'
import { uid } from './types'
import { containsPolygon } from '../geometry/polygons'
import { stairOpening } from '../geometry/stairs'
import { stairPlacementValid } from '../geometry/stairPlacement'

export function connectStairGuide(project: Project, levelId: string, guideId: string, targetId: string, form: Stair['form'], reverse: boolean) {
  const levels = project.buildings[0].levels, from = levels.find(level => level.id === levelId), to = levels.find(level => level.id === targetId)
  const guide = from?.stairGuides?.find(item => item.id === guideId)
  if (!from || !to || !guide) return 'Choose an upper level for this detected stair footprint.'
  if (from.locked || to.locked) return 'Unlock both levels before connecting this stair.'
  if (to.elevation <= from.elevation + .5) return 'The destination must be above this floor.'
  if (from.stairs?.some(stair => stair.guideId === guideId)) return 'This footprint is already connected.'
  const xs = guide.polygon.map(point => point.x), zs = guide.polygon.map(point => point.z)
  const x1 = Math.min(...xs), x2 = Math.max(...xs), z1 = Math.min(...zs), z2 = Math.max(...zs), vertical = z2 - z1 > x2 - x1
  const start = vertical ? { x: (x1 + x2) / 2, z: reverse ? z2 : z1 } : { x: reverse ? x2 : x1, z: (z1 + z2) / 2 }
  const stair: Stair = { id: uid('stair'), guideId, fromLevelId: from.id, toLevelId: to.id, start,
    direction: (vertical ? 90 : 0) + (reverse ? 180 : 0), form, width: Math.max(.6, Math.min(2.4, vertical ? x2 - x1 : z2 - z1)),
    riserHeight: .17, treadDepth: .28, landingLength: 1.2, openingId: uid('opening') }
  const polygon = stairOpening(stair, levels)
  if (!polygon.length || polygon.some(point => point.x < x1 - .2 || point.x > x2 + .2 || point.z < z1 - .2 || point.z > z2 + .2))
    return 'The drawn footprint does not fit a complete stair for this floor rise and flight form. Review the scale and stairwell dimensions before connecting it.'
  if (!stairPlacementValid(stair, levels, to.slabs || []))
    return 'A complete stair to this floor does not fit at the detected footprint. Check its direction, flight form, floor height and upper slab before placing it.'
  const slab = to.slabs?.find(item => containsPolygon(item.polygon, polygon))
  if (!slab) return 'The upper floor needs a slab around the complete stair.'
  from.stairs ||= []; from.stairs.push(stair)
  slab.openings.push({ id: stair.openingId!, kind: 'stair', polygon })
  return null
}
