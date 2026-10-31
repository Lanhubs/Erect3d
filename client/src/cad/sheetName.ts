import type { Project } from '../domain/types'
import type { CadSceneOptions } from './scene'

export type CadSheetFormat = 'dxf' | 'dwg'

const slug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'plan'

/** The scope word names the floors the user picked, never an internal id. */
export function cadScope(project: Project, options: CadSceneOptions) {
  if (options.allLevels) return 'all-floors'
  return project.buildings[0]?.levels.find((level) => level.id === options.levelId)?.name || 'floor'
}

/** A dated sheet never overwrites the one before it, on disk or in the asset library. */
export function cadSheetName(
  project: Project,
  options: CadSceneOptions,
  format: CadSheetFormat,
  today = new Date(),
) {
  return `${slug(project.name)}-${slug(cadScope(project, options))}-${today.toISOString().slice(0, 10)}.${format}`
}
