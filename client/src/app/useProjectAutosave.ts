import { useCallback, useEffect } from 'react'
import type { Project } from '../domain/types'
import { useProject } from '../state/project'
import { saveProject } from '../state/database'
export function useProjectAutosave(project: Project) {
  const dirty = useProject((state) => state.dirty),
    version = useProject((state) => state.version)
  const previewBase = useProject((state) => state.previewBase),
    markSaved = useProject((state) => state.markSaved)
  useEffect(() => {
    if (!dirty || previewBase) return
    const timer = setTimeout(
      () =>
        saveProject(project)
          .then(() => markSaved(version))
          .catch(console.error),
      900,
    )
    return () => clearTimeout(timer)
  }, [project, dirty, markSaved, version, previewBase])
  return useCallback(async () => {
    useProject.getState().finishPreview()
    const state = useProject.getState()
    if (state.project) {
      await saveProject(state.project)
      state.markSaved(state.version)
    }
  }, [])
}
