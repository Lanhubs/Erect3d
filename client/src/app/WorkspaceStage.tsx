import { useEffect, useState, type ReactNode } from 'react'
import type { View } from '../state/project'
export function WorkspaceStage({
  view,
  mode,
  plan,
  viewer,
  analysis,
}: {
  view: View
  mode: 'edit' | 'analyze' | 'present'
  plan: ReactNode
  viewer: ReactNode
  analysis: ReactNode
}) {
  const [viewerReady, setViewerReady] = useState(view !== 'plan' || mode === 'present'),
    [planReady, setPlanReady] = useState(view !== 'model')
  const [primary, setPrimary] = useState<'plan' | 'model'>('model'),
    [expanded, setExpanded] = useState(false)
  useEffect(() => {
    if (view !== 'plan' || mode === 'present') setViewerReady(true)
    if (view !== 'model') setPlanReady(true)
  }, [view, mode])
  const current = mode === 'present' ? 'model' : view
  return (
    <div className="workspace-stage">
      <div
        hidden={mode === 'analyze'}
        className={`view-area ${current} primary-${primary}${expanded ? ' preview-expanded' : ''}`}
      >
        <div className="plan-pane" hidden={current === 'model'}>
          {planReady && plan}
        </div>
        <div className="model-pane" hidden={current === 'plan'}>
          {viewerReady && viewer}
        </div>
        {current === 'split' && (
          <div className="split-preview-actions">
            <button
              aria-label="Swap views"
              onClick={() => setPrimary((value) => (value === 'model' ? 'plan' : 'model'))}
            >
              Swap
            </button>
            <button
              aria-label={expanded ? 'Shrink preview' : 'Enlarge preview'}
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? '−' : '+'}
            </button>
          </div>
        )}
      </div>
      {mode === 'analyze' && analysis}
    </div>
  )
}
