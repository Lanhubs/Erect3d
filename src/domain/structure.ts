import type { Project, Stair } from './types'
import { containsPolygon } from '../geometry/polygons'
import { stairOpening, stairSteps } from '../geometry/stairs'

export function updateStair(project: Project, id: string, change: Partial<Stair>): string | null {
  const levels = project.buildings[0].levels
  const from = levels.find(level => level.stairs?.some(stair => stair.id === id))
  const existing = from?.stairs?.find(stair => stair.id === id)
  if (!from || !existing) return 'Stair no longer exists.'
  const next = { ...existing, ...change }
  if (!stairSteps(next, levels).length) return 'Enter a valid stair width, riser and tread depth.'
  const opening = stairOpening(next, levels)
  const upper = levels.find(level => level.id === next.toLevelId)
  const slab = upper?.slabs?.find(item => containsPolygon(item.polygon, opening))
  if (!slab) return 'The stair opening must fit within an upper-floor slab.'
  upper?.slabs?.forEach(item => { item.openings = item.openings.filter(value => value.id !== existing.openingId) })
  slab.openings.push({ id: existing.openingId || crypto.randomUUID(), kind: 'stair', polygon: opening })
  Object.assign(existing, next)
  return null
}
