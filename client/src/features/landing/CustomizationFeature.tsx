import { lazy, Suspense, useEffect, useRef, useState } from 'react'

const ExplodedBuildingPreview = lazy(() => import('./ExplodedBuildingPreview'))

function CustomizationVisual() {
  const frame = useRef<HTMLDivElement>(null)
  const [nearViewport, setNearViewport] = useState(false)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!frame.current || !('IntersectionObserver' in window)) { setNearViewport(true); setVisible(true); return }
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting)
      if (entry.isIntersecting) setNearViewport(true)
    }, { rootMargin: '220px' })
    observer.observe(frame.current)
    return () => observer.disconnect()
  }, [])
  return <div className="customization-visual" ref={frame} aria-label="Animated exploded building model with editable architectural components">
    {nearViewport && <Suspense fallback={<div className="customization-model-loading" aria-hidden="true" />}>
      <ExplodedBuildingPreview active={visible} />
    </Suspense>}
    <svg className="customization-leaders" viewBox="0 0 1000 430" preserveAspectRatio="none" aria-hidden="true">
      <path d="M190 66H316L404 104" />
      <path d="M810 84H724L650 170" />
      <path d="M824 214H740L656 242" />
      <path d="M805 362H690L570 342" />
      <path d="M202 355H307L380 317" />
      <circle cx="404" cy="104" r="4" /><circle cx="650" cy="170" r="4" />
      <circle cx="656" cy="242" r="4" /><circle cx="570" cy="342" r="4" /><circle cx="380" cy="317" r="4" />
    </svg>
    <div className="callout callout-roof"><strong>Roof</strong><span>covering / pitch</span></div>
    <div className="callout callout-window"><strong>Window</strong><span>frame / glazing</span></div>
    <div className="callout callout-door"><strong>Door</strong><span>leaf / opening</span></div>
    <div className="callout callout-floor"><strong>Floor</strong><span>slab / finish</span></div>
    <div className="callout callout-fence"><strong>Fence</strong><span>boundary / gate</span></div>
  </div>
}

export function CustomizationFeature() {
  return <section className="customization-section">
    <CustomizationVisual />
    <div className="customization-copy">
      <p className="eyebrow">ARCHITECTURAL CUSTOMIZATION</p>
      <h3>Keep the building editable as it develops.</h3>
      <p>
        Erect3D keeps the model flexible. Adjust walls, doors, windows, flooring, roofs, verandas,
        materials and building entrances while the spatial model stays in sync.
      </p>
    </div>
  </section>
}
