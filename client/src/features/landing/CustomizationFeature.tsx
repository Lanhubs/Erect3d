import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { ComponentAnchors } from './ExplodedBuildingPreview'

const ExplodedBuildingPreview = lazy(() => import('./ExplodedBuildingPreview'))

function CustomizationVisual() {
  const frame = useRef<HTMLDivElement>(null)
  const [nearViewport, setNearViewport] = useState(false)
  const [anchors, setAnchors] = useState<ComponentAnchors | null>(null)
  useEffect(() => {
    if (!frame.current || !('IntersectionObserver' in window)) {
      setNearViewport(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setNearViewport(true)
      },
      { rootMargin: '220px' },
    )
    observer.observe(frame.current)
    return () => observer.disconnect()
  }, [])
  return (
    <div
      className="customization-visual"
      ref={frame}
      aria-label="Exploded building model with labeled editable architectural components"
    >
      {nearViewport && (
        <Suspense fallback={<div className="customization-model-loading" aria-hidden="true" />}>
          <ExplodedBuildingPreview onAnchors={setAnchors} />
        </Suspense>
      )}
      {anchors && (
        <svg
          className="customization-leaders"
          viewBox="0 0 1000 430"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {(
            [
              ['roof', 'M190 66H316'],
              ['window', 'M810 84H724'],
              ['door', 'M190 214H270'],
              ['floor', 'M202 362H307'],
              ['fence', 'M805 355H690'],
            ] as const
          ).map(([name, start]) => (
            <g key={name}>
              <path d={`${start}L${anchors[name][0]} ${anchors[name][1]}`} />
              <circle cx={anchors[name][0]} cy={anchors[name][1]} r="4" />
            </g>
          ))}
        </svg>
      )}
      <div className="callout callout-roof">
        <strong>Roof</strong>
        <span>covering / pitch</span>
      </div>
      <div className="callout callout-window">
        <strong>Window</strong>
        <span>frame / glazing</span>
      </div>
      <div className="callout callout-door">
        <strong>Door</strong>
        <span>leaf / opening</span>
      </div>
      <div className="callout callout-floor">
        <strong>Floor</strong>
        <span>slab / finish</span>
      </div>
      <div className="callout callout-fence">
        <strong>Fence</strong>
        <span>boundary / gate</span>
      </div>
    </div>
  )
}

export function CustomizationFeature() {
  return (
    <section className="customization-section">
      <CustomizationVisual />
      <div className="customization-copy">
        <p className="eyebrow">ARCHITECTURAL CUSTOMIZATION</p>
        <h3>Keep the building editable as it develops.</h3>
        <p>
          Erect3D keeps the model flexible. Adjust walls, doors, windows, flooring, roofs, verandas, materials
          and building entrances while the spatial model stays in sync.
        </p>
      </div>
    </section>
  )
}
