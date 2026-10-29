import type { Project, Selection } from './types'

export function assistantSelection(project: Project | null, selection: Selection) {
  if (!project || !selection) return undefined
  const collection = {
    room: 'rooms',
    wall: 'walls',
    door: 'doors',
    window: 'windows',
    passage: 'passages',
    slab: 'slabs',
    column: 'columns',
    stair: 'stairs',
    ramp: 'ramps',
    detail: 'details',
    furniture: 'furniture',
  } as const
  for (const building of project.buildings) {
    for (const level of building.levels) {
      const field = collection[selection.kind as keyof typeof collection]
      const item =
        field &&
        (level[field] as { id: string; name?: string; type?: string }[] | undefined)?.find(
          (e) => e.id === selection.id,
        )
      if (item)
        return { building, level, name: item.name || item.type?.replaceAll('-', ' ') || selection.kind }
    }
    const system = building.systems?.systems.find((s) => s.id === selection.id)
    if (system) {
      const level = building.levels.find((l) => l.id === system.levelId)
      if (level) return { building, level, name: system.name || system.kind.replaceAll('-', ' ') }
    }
  }
  return undefined
}
