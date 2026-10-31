import { useEffect, type Dispatch, type SetStateAction } from 'react'
import { dismissMenu } from './useOverlay'
import type { Tool } from '../state/project'

export function useWorkspaceShortcuts({
  previewing,
  redo,
  setSearching,
  setTool,
  undo,
}: {
  previewing: boolean
  redo: () => void
  setSearching: Dispatch<SetStateAction<boolean>>
  setTool: (tool: Tool) => void
  undo: () => void
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (dismissMenu(event)) return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearching((value) => !value)
        return
      }
      if (previewing) return
      if (
        event.defaultPrevented ||
        (event.target instanceof HTMLElement &&
          event.target.closest('input,select,textarea,[contenteditable=true]'))
      )
        return
      if (event.key === 'Escape') setTool('select')
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setTool, undo, redo, previewing, setSearching])
}
