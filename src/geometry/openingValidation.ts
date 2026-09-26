import type { Door, Level, Passage, WindowUnit } from '../domain/types'
import { wallLength } from './math'

export type HostedOpening = Door | WindowUnit | Passage
export function validateOpening(level: Level, opening: HostedOpening, ownId = opening.id): string | null {
  const wall = level.walls.find(item => item.id === opening.wallId)
  if (!wall) return 'The host wall is missing.'
  const numbers = [opening.offset, opening.width, opening.height]
  if (numbers.some(value => !Number.isFinite(value))) return 'Enter a valid number.'
  if (opening.offset < .05 || opening.width < .3 || opening.offset + opening.width > wallLength(wall) - .05)
    return 'The opening must fit inside its host wall.'
  if (opening.height < .3 || opening.height > wall.height) return 'The opening height must fit inside the wall.'
  if ('sill' in opening && (opening.sill < 0 || opening.sill + opening.height > wall.height))
    return 'The sill and glazing must fit inside the wall height.'
  const others = [...level.doors, ...level.windows, ...(level.passages || [])].filter(item => item.id !== ownId && item.wallId === opening.wallId)
  if (others.some(item => opening.offset < item.offset + item.width + .05 && opening.offset + opening.width + .05 > item.offset))
    return 'This opening overlaps another opening on the wall.'
  return null
}
