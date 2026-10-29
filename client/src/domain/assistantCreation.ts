import type { Project } from './types'
import type { AssistantScope } from '../../../api/src/contracts/assistant'

export function buildingCreationBrief(message: string) {
  const text = message
    .toLowerCase()
    .replace(/\bbuiding\b|\bbulding\b/g, 'building')
    .replace(/\bfurnintures?\b/g, 'furniture')
  if (/\b(?:do not|don't|never)\s+(?:create|build|design|generate|craft|make)\b/.test(text)) return undefined
  const action =
    /\b(?:craft|create|design|generate|build|draw|make)\s+(?:(?:for\s+me|me|please)\s+)?(?:a\s+|an\s+|new\s+|my\s+dream\s+|dream\s+)?([^.!?\n]{0,100})/.exec(
      text,
    )
  if (!action || /^(?:this|that|our|existing|the(?!\s+new\b)|my existing)\b/.test(action[1])) return undefined
  const target =
    /\b(?:house|home|building|mansion|villa|cottage|hotel|office|skyscraper|school|hospital|duplex|apartment|palace|temple)\b/.exec(
      action[1],
    )
  if (
    !target ||
    /\b(?:roof|door|window|furniture|sofa|room|bedroom|bathroom|kitchen|lounge|extension|addition|interior|facade|garden|garage|patio|porch|balcony|stair|wall|floor plan of)\b/.test(
      action[1].slice(0, target.index),
    )
  )
    return undefined
  const count =
    /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)[\s-]*(?:storeys?|stories|story|floors?)\b/.exec(
      text,
    )
  const words = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
  const storeys = count
    ? /^\d+$/.test(count[1])
      ? Number(count[1])
      : words.indexOf(count[1]) + 1
    : undefined
  return { message, storeys, furnished: /\bfurnitur|\bfurnish|\bfurnit/.test(text) }
}

// Explicit creation is building-wide intent. An unrelated element selection is not a prerequisite.
export function creationScope(project: Project | null, scope: AssistantScope | undefined, message: string) {
  if (!project || !buildingCreationBrief(message)) return scope
  const building = project.buildings.find((b) => b.id === scope?.buildingId) || project.buildings[0]
  const level = building?.levels.find((l) => l.id === scope?.levelId) || building?.levels[0]
  return building && level ? { mode: 'building' as const, buildingId: building.id, levelId: level.id } : scope
}
