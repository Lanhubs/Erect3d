import type { Project } from '../../client/src/domain/types'
import type { Change } from '../src/contracts/operations'
import { documentChanges } from './diff'
// Keep ordinary edits granular. Large floor replacements/Undo use the existing
// entity replacement contract so the entire architecture commits atomically.
export function compactDocumentChanges(before: Project, after: Project): Change[] {
  let changes = documentChanges(before, after)
  if (changes.length <= 512) return changes
  const group = (path: string[], value: unknown) => {
    const matches = (change: Change) => path.every((part, index) => change.path[index] === part)
    if (!changes.some(matches)) return
    changes = changes.filter((change) => !matches(change))
    changes.push(value === undefined ? { action: 'delete', path } : { action: 'put', path, value })
  }
  for (const building of before.buildings) {
    const next = after.buildings.find((item) => item.id === building.id)
    if (!next) continue
    for (const level of building.levels) {
      group(
        ['buildings', building.id, 'levels', level.id],
        next.levels.find((item) => item.id === level.id),
      )
    }
    group(['buildings', building.id, 'roofSections'], next.roofSections)
  }
  group(['interpretation'], after.interpretation)
  return changes
}
