import type { Project } from '../../contracts/project'
import type { AssistantScope } from '../../contracts/assistant'
import { ApiError } from '../../security/errors'
import { collections, type Target } from './entities'
export function scopeContext(project: Project, scope: AssistantScope) {
  const building = project.buildings.find((b) => b.id === scope.buildingId),
    level = building?.levels.find((l) => l.id === scope.levelId)
  if (!building || !level) throw new ApiError(422, 'ASSISTANT_SCOPE', 'Choose a floor in this project')
  const allowed = new Set<string>()
  if (scope.mode === 'selection') {
    if (!scope.entityId) throw new ApiError(422, 'ASSISTANT_SCOPE', 'Select an element first')
    allowed.add(scope.entityId)
    const wall = level.walls.find((w) => w.id === scope.entityId)
    if (wall)
      for (const item of [...level.doors, ...level.windows, ...(level.passages || [])])
        if (item.wallId === wall.id) allowed.add(item.id)
    const room = level.rooms.find((r) => r.id === scope.entityId)
    if (room) for (const item of level.furniture || []) if (item.roomId === room.id) allowed.add(item.id)
    const exists =
      building.systems?.systems.some((s) => s.id === scope.entityId) ||
      building.siteFence?.id === scope.entityId ||
      Object.values(collections).some((c) =>
        (level[c] as { id: string }[] | undefined)?.some((e) => e.id === scope.entityId),
      )
    if (!exists) throw new ApiError(422, 'ASSISTANT_SCOPE', 'Select an element on the active floor')
  }
  return { building, level, allowed }
}
export function permitTarget(scope: AssistantScope, target: Target, allowed: Set<string>) {
  if (target.building.id !== scope.buildingId)
    throw new ApiError(422, 'ASSISTANT_SCOPE', 'The change is outside the selected building')
  if (target.level?.locked)
    throw new ApiError(409, 'LEVEL_LOCKED', 'Unlock this floor before requesting changes')
  if (scope.mode === 'building') return
  if (scope.mode === 'level' && target.level?.id === scope.levelId) return
  if (scope.mode === 'selection' && allowed.has(target.value?.id || String(target.key))) return
  throw new ApiError(422, 'ASSISTANT_SCOPE', 'Choose a wider scope to change this part of the model')
}
