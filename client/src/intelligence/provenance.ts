import type { Project } from '../domain/types'
export function modelEntities(project: Project) {
  return project.buildings.flatMap(building => building.levels.flatMap(level => [
    ...level.walls, ...level.doors, ...level.windows, ...(level.passages || []), ...level.rooms,
    ...(level.columns || []), ...(level.slabs || []), ...(level.stairs || []), ...(level.ramps || []),
    ...(level.details || []), ...(level.furniture || []),
  ]))
}
export function confirmManualChanges(before: Project, next: Project) {
  if (next.interpretation) next.interpretation = { ...next.interpretation }
  const previous = new Map(modelEntities(before).map(entity => [entity.id, entity]))
  for (const entity of modelEntities(next)) {
    const old = previous.get(entity.id)
    const fields = Object.keys(entity).filter(field => field !== 'id' && JSON.stringify((old as unknown as Record<string, unknown>)?.[field]) !== JSON.stringify((entity as unknown as Record<string, unknown>)[field]))
    if (!fields.length) continue
    next.interpretation ||= {}
    const record = next.interpretation[entity.id]
    next.interpretation[entity.id] = { ...record, origin: record?.origin || 'user-selected',
      confirmedFields: [...new Set([...(record?.confirmedFields || (old ? Object.keys(old).filter(field => field !== 'id') : [])), ...fields])] }
  }
}
