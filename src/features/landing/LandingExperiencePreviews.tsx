import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { ArchitecturalPreviewMode } from './ArchitecturalPreviews3D'

const ArchitecturalPreviews3D = lazy(() => import('./ArchitecturalPreviews3D'))
const viewOptions: Array<{ id: ArchitecturalPreviewMode; label: string }> = [
  { id: 'plan', label: 'Plan' }, { id: 'model', label: 'Model' },
  { id: 'walk', label: 'Walk' }, { id: 'section', label: 'Section' },
]

function PreviewCanvas({ mode, className }: { mode: ArchitecturalPreviewMode; className: string }) {
  const frame = useRef<HTMLDivElement>(null)
  const [nearViewport, setNearViewport] = useState(false)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!frame.current || !('IntersectionObserver' in window)) { setNearViewport(true); setVisible(true); return }
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting)
      if (entry.isIntersecting) setNearViewport(true)
    }, { rootMargin: '180px' })
    observer.observe(frame.current)
    return () => observer.disconnect()
  }, [])
  return <div className={`preview-canvas-frame ${className}`} ref={frame}>
    {nearViewport && <Suspense fallback={<div className="preview-canvas-loading" aria-hidden="true" />}>
      <ArchitecturalPreviews3D mode={mode} active={visible} />
    </Suspense>}
  </div>
}

export function WalkthroughPreview() {
  return <div className="walkthrough-visual" aria-label="Animated first-person interior walkthrough preview">
    <PreviewCanvas mode="walk" className="walkthrough-scene-frame" />
    <div className="walkthrough-hud" aria-hidden="true"><span>INTERIOR VIEW</span><i /></div>
    <div className="walkthrough-crosshair" aria-hidden="true" />
  </div>
}

export function ArchitecturalViewsPreview() {
  const [view, setView] = useState<ArchitecturalPreviewMode>('model')
  return <>
    <div className="view-selector" role="tablist" aria-label="Architectural view previews">
      {viewOptions.map(option => <button type="button" role="tab" aria-selected={view === option.id}
        className={view === option.id ? 'active' : ''} key={option.id} onClick={() => setView(option.id)}>
        {option.label}
      </button>)}
    </div>
    <div className="views-visual" aria-label={`${viewOptions.find(option => option.id === view)?.label} view preview`}>
      <PreviewCanvas mode={view} className="architectural-scene-frame" />
      <div className="views-readout" aria-live="polite">
        <span>{viewOptions.find(option => option.id === view)?.label} view</span>
        <span>COURTYARD RESIDENCE · GROUND FLOOR</span>
      </div>
    </div>
  </>
}
