import { FiMoreHorizontal, FiNavigation, FiPlay, FiSliders } from 'react-icons/fi'
import type { Selection } from '../domain/types'
import type { View } from '../state/project'
import { choose, type WorkspaceMode } from './menuChoice'

type Props = {
  mode: WorkspaceMode
  setMode: (mode: WorkspaceMode) => void
  view: View
  setView: (view: View) => void
  walk: () => void
  walking: boolean
  selection: Selection
  inspectorOpen: boolean
  toggleInspector: () => void
  inspectorAvailable: boolean
}

export function StudioViewDock({
  mode,
  setMode,
  view,
  setView,
  walk,
  walking,
  selection,
  inspectorOpen,
  toggleInspector,
  inspectorAvailable,
}: Props) {
  return (
    <div className="studio-view-dock" aria-label="Workspace view">
      <div className="studio-view-switch">
        {(['plan', 'split', 'model'] as const).map((next, i) => (
          <button
            key={next}
            aria-pressed={mode === 'edit' && view === next}
            onClick={() => {
              setMode('edit')
              setView(next)
            }}
          >
            {['2D', 'Split', '3D'][i]}
          </button>
        ))}
      </div>
      <button
        className="studio-walk"
        aria-label={walking ? 'Exit walk' : 'Walk'}
        aria-pressed={walking}
        onClick={walk}
        data-tooltip={walking ? 'Exit walkthrough' : 'Walk through the building'}
      >
        <FiNavigation />
        <span>{walking ? 'Exit walk' : 'Walk'}</span>
      </button>
      <button
        className="studio-present"
        aria-label="Present"
        aria-pressed={mode === 'present'}
        onClick={() => setMode('present')}
        data-tooltip="Present building"
      >
        <FiPlay />
        <span>Present</span>
      </button>
      <details className="studio-menu studio-view-menu">
        <summary aria-label="More view modes">
          <FiMoreHorizontal />
        </summary>
        <div>
          <button
            aria-pressed={mode === 'analyze'}
            onClick={(event) => choose(event, () => setMode('analyze'))}
          >
            Analyze building
          </button>
          <button
            aria-pressed={mode === 'present'}
            onClick={(event) => choose(event, () => setMode('present'))}
          >
            Present building
          </button>
        </div>
      </details>
      {inspectorAvailable && (
        <button
          className="studio-properties-trigger"
          aria-label="Toggle properties"
          data-tooltip={selection ? 'Selected element properties' : 'Properties'}
          aria-pressed={inspectorOpen}
          onClick={toggleInspector}
        >
          <FiSliders />
        </button>
      )}
    </div>
  )
}
