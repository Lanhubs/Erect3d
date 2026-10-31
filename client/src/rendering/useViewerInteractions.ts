import { useCallback, useRef } from 'react'
import { zoomEvent, type ZoomDetail } from '../app/useWorkspaceZoom'
import { useElementEditing } from '../features/editing/useElementEditing'
import { useProject } from '../state/project'
import { useSceneIssues } from './SceneIssue'
import { useViewportActivity } from './useViewportActivity'
import type { Selection } from '../domain/types'

/** Focus host, viewport visibility, scene diagnostics, gizmo editing and click-to-deselect. */
export function useViewerInteractions({
  active,
  presentation,
  previewOnly,
  select,
  walk,
}: {
  active: boolean
  presentation: boolean
  previewOnly: boolean
  select: (selection: Selection) => void
  walk: boolean
}) {
  const viewerRef = useRef<HTMLElement | null>(null)
  const visible = useViewportActivity(viewerRef, active),
    sceneIssues = useSceneIssues(viewerRef)
  const tool = useProject((state) => state.tool)
  const editing = useElementEditing(!previewOnly && !walk && !presentation && tool === 'select')
  const clearSelection = useCallback(
    (event: MouseEvent) => {
      if (event.button === 0 && active && !previewOnly && !walk && !presentation && tool === 'select') {
        select(null)
        if (event.target instanceof HTMLCanvasElement) event.target.style.cursor = ''
      }
    },
    [active, previewOnly, walk, presentation, tool, select],
  )
  const zoomCamera = (detail: ZoomDetail) =>
    viewerRef.current?.dispatchEvent(new CustomEvent<ZoomDetail>(zoomEvent, { detail }))
  return { clearSelection, editing, sceneIssues, viewerRef, visible, zoomCamera }
}
