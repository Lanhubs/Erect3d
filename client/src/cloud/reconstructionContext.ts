import { activeLevel, type Project } from '../domain/types'
import { useProject } from '../state/project'

export type ReconstructionContext = { projectId: string; levelId: string; sourceId: string }
export function reconstructionContext(project: Project, levelId: string | null): ReconstructionContext {
  const level = activeLevel(project, levelId)
  return { projectId: project.id, levelId: level.id, sourceId: level.sourceId || '' }
}
export function sameReconstructionSource(a?: ReconstructionContext, b?: ReconstructionContext) {
  return Boolean(a && b && a.projectId === b.projectId && a.levelId === b.levelId && a.sourceId === b.sourceId)
}
export function currentReconstructionSource(context: ReconstructionContext) {
  const { project, activeLevelId } = useProject.getState()
  return Boolean(project && sameReconstructionSource(context, reconstructionContext(project, activeLevelId)))
}
