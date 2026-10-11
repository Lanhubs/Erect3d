import type { Project } from '../../contracts/project'
import { checksum } from '../../security/tokens'
import { ApiError } from '../../security/errors'

export function validateLockedLevels(before: Project, after: Project) {
  for (const building of before.buildings) {
    for (const level of building.levels.filter(item => item.locked)) {
      const next = after.buildings.find(item => item.id === building.id)?.levels.find(item => item.id === level.id)
      if (!next) throw new ApiError(409, 'LEVEL_LOCKED', 'Unlock the level before deleting it')
      const geometry = ({ name: _name, visible: _visible, locked: _locked, ...value }: typeof level) => value
      if (checksum(geometry(level)) !== checksum(geometry(next))) {
        throw new ApiError(409, 'LEVEL_LOCKED', 'Unlock the level before editing its architecture')
      }
    }
  }
}
