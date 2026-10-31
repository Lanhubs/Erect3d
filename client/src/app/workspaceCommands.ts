import type { Dispatch, SetStateAction } from 'react'
import { panels, type PanelId } from './WorkspacePanels'
import { drawingTools, type WorkspaceMode } from './WorkspaceHeader'
import type { Tool, View } from '../state/project'
import type { WorkspaceCommand } from './CommandSearch'

export function buildWorkspaceCommands({
  assistant,
  chooseView,
  collaborate,
  readOnly,
  redo,
  save,
  setMode,
  setPanel,
  setTool,
  undo,
  walk,
}: {
  assistant?: () => void
  chooseView: (view: View) => void
  collaborate?: () => void
  readOnly: boolean
  redo: () => void
  save: () => void
  setMode: Dispatch<SetStateAction<WorkspaceMode>>
  setPanel: Dispatch<SetStateAction<PanelId | null>>
  setTool: (tool: Tool) => void
  undo: () => void
  walk: () => void
}): WorkspaceCommand[] {
  return [
    ...(assistant
      ? [
          {
            id: 'assistant',
            label: 'Design assistant',
            keywords: 'chat prompt improve building',
            run: assistant,
          },
        ]
      : []),
    ...(collaborate
      ? [
          {
            id: 'collaborate',
            label: 'Collaborate',
            keywords: 'people access sharing comments',
            run: collaborate,
          },
        ]
      : []),
    ...panels.map((item) => ({
      id: item.id,
      label: item.label,
      keywords: item.keywords,
      run: () => setPanel(item.id),
    })),
    ...drawingTools.map((item) => ({
      id: item.id,
      label: `Draw / ${item.label}`,
      run: () => {
        setMode('edit')
        setTool(item.id)
      },
      disabled: readOnly && !['select', 'pan', 'measure'].includes(item.id),
    })),
    { id: 'undo', label: 'Undo', run: undo, disabled: readOnly },
    { id: 'redo', label: 'Redo', run: redo, disabled: readOnly },
    { id: 'save', label: 'Save', run: save, disabled: readOnly },
    ...(['plan', 'split', 'model'] as const).map((next, i) => ({
      id: `view-${next}`,
      label: ['2D plan', 'Split view', '3D model'][i],
      run: () => {
        setMode('edit')
        chooseView(next)
      },
    })),
    { id: 'walk', label: 'Walk through building', run: walk },
    { id: 'analyze', label: 'Analyze building', run: () => setMode('analyze') },
    { id: 'present', label: 'Present building', run: () => setMode('present') },
  ]
}
