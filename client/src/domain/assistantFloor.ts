import type { Building } from './types'

type Scope = { mode: 'level' | 'building' | 'selection'; levelId: string }
const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
const ordinals = [
  'ground',
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'eighth',
  'ninth',
  'tenth',
]
function floorName(text: string) {
  return normalize(text)
    .replace(/\b(\d+)(?:st|nd|rd|th)\b/g, '$1')
    .replace(
      /\b(ground|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+(?:floor|storey)\b/g,
      (_, word: string) => `floor ${ordinals.indexOf(word)}`,
    )
    .replace(/\b(?:level|storey)\s+(\d+)\b/g, 'floor $1')
    .replace(/\b(\d+)\s+(?:floor|storey)\b/g, 'floor $1')
}
// Match explicit names, never guess a storey from array order or widen the selected scope.
export function resolveAssistantFloor(building: Pick<Building, 'levels'>, scope: Scope, message: string) {
  if (scope.mode === 'building') return { levelId: scope.levelId }
  const text = ` ${floorName(message)} `
  const names = building.levels.filter((level) => {
    const name = floorName(level.name)
    return (
      name &&
      (name.includes('floor ') || /\b(?:floor|level|basement|penthouse|mezzanine)\b/.test(name)) &&
      text.includes(` ${name} `)
    )
  })
  const references = [...text.matchAll(/\bfloor \d+\b/g)].map((match) => match[0])
  const unique = [...new Set(references)]
  const missing = unique.some((reference) => !names.some((level) => floorName(level.name) === reference))
  if (names.length > 1 || unique.length > 1)
    return {
      levelId: scope.levelId,
      question:
        'Which single floor should I change? Choose Whole building for a request spanning several floors.',
    }
  if (missing)
    return {
      levelId: scope.levelId,
      question: `Which existing floor do you mean? Available floors: ${building.levels.map((level) => level.name).join(', ')}.`,
    }
  const target = names[0]
  if (target && scope.mode === 'selection' && target.id !== scope.levelId)
    return {
      levelId: scope.levelId,
      question: `Your selection belongs to another floor. Choose This floor to target ${target.name}.`,
    }
  return { levelId: target?.id || scope.levelId }
}
