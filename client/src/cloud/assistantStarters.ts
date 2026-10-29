import type { AssistantScope } from './assistantTypes'
import type { Project } from '../domain/types'

export const assistantStarters = {
  review: {
    label: 'Review this floor',
    message:
      'Review this floor using its complete model diagnostics. Prepare actual corrections for any misplaced furniture, disconnected openings or circulation problems that can be safely resolved. Preserve valid geometry. If no safe correction is needed, explain what you checked; do not invent changes or ask me to select a room.',
  },
  improve: {
    label: 'Improve this floor',
    message:
      'Improve this floor. Inspect its complete model diagnostics and prepare actual, coordinated edits that improve furniture placement, usable circulation and consistent interior finishes. Preserve the existing floor layout, walls, doors, windows and structural connections unless a specific defect requires a correction. Explain your design choices. Do not merely describe a proposal: use the edit tools and validate the changes.',
  },
  roof: {
    label: 'Improve the roof',
    message:
      'Improve the roof of this floor. Prepare an actual coordinated roof design that fits its existing footprint and preserves courtyards and upper-floor relationships. Use the existing roof settings and edit tools; do not just suggest a design in text.',
  },
} as const
export type AssistantStarter = keyof typeof assistantStarters

export function assistantStarterRequest(
  project: Project | null,
  activeId: string | null,
  starter: AssistantStarter,
) {
  const building = project?.buildings.find((building) =>
    building.levels.some((level) => level.id === activeId),
  )
  const level = building?.levels.find((level) => level.id === activeId)
  if (!building || !level) throw new Error('Open a floor before starting a review.')
  if (level.locked) throw new Error('Unlock this floor before requesting changes.')
  const scope: AssistantScope = { mode: 'level', buildingId: building.id, levelId: level.id }
  return { message: assistantStarters[starter].message, scope, fresh: true }
}
