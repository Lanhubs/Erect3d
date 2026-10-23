import type { Project, Stair } from './types'
import { containsPolygon } from '../geometry/polygons'
import { stairOpening, stairSteps } from '../geometry/stairs'
import { stairPlacementValid } from '../geometry/stairPlacement'

export function updateStair(project: Project, id: string, change: Partial<Stair>): string | null {
  const levels = project.buildings[0].levels
  const from = levels.find((level) => level.stairs?.some((stair) => stair.id === id))
  const existing = from?.stairs?.find((stair) => stair.id === id)
  if (!from || !existing) return 'Stair no longer exists.'
  const next = { ...existing, ...change }
  if (!stairSteps(next, levels).length) return 'Enter a valid stair width, riser and tread depth.'
  const opening = stairOpening(next, levels)
  const upper = levels.find((level) => level.id === next.toLevelId)
  if (from.locked || upper?.locked) return 'Unlock both connected floors before editing the stair.'
  const slab = upper?.slabs?.find((item) => containsPolygon(item.polygon, opening))
  if (!slab) return 'The stair opening must fit within an upper-floor slab.'
  if (!stairPlacementValid(next, levels, upper?.slabs || []))
    return 'The stair crosses a wall or floor opening. Move or rotate it into clear circulation space.'
  upper?.slabs?.forEach((item) => {
    item.openings = item.openings.filter((value) => value.id !== existing.openingId)
  })
  next.openingId = existing.openingId || crypto.randomUUID()
  slab.openings.push({ id: next.openingId, kind: 'stair', polygon: opening })
  Object.assign(existing, next)
  return null
}
