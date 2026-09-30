import { lazy, Suspense, useEffect, useRef, useState } from 'react'

const AnimatedModel = lazy(() => import('./AnimatedModelPreview'))

function FloorPlanPreview() {
  return <svg className="comparison-plan-svg" viewBox="0 0 640 380" role="img" aria-label="Architectural floor plan with four rooms, doors and windows">
    <defs>
      <pattern id="comparison-plan-grid" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#d9ded8" strokeWidth="1" />
      </pattern>
    </defs>
    <rect width="640" height="380" fill="#f3f4ef" />
    <rect x="20" y="20" width="600" height="340" fill="url(#comparison-plan-grid)" />
    <rect x="74" y="38" width="492" height="304" fill="#fbfaf6" />
    <path d="M74 38H566V342H74Z" fill="none" stroke="#37433f" strokeWidth="12" />
    <path d="M279 38V342M279 190H566M422 190V342" fill="none" stroke="#59635e" strokeWidth="8" />
    <path d="M184 342H238M465 38H512M566 94V148" fill="none" stroke="#fbfaf6" strokeWidth="14" />
    <path d="M184 336V282M184 282A54 54 0 0 1 238 336" fill="none" stroke="#8a6848" strokeWidth="3" />
    <path d="M279 112H326M326 112A47 47 0 0 1 279 159" fill="none" stroke="#8a6848" strokeWidth="3" />
    <path d="M422 232V278M422 278A46 46 0 0 0 468 232" fill="none" stroke="#8a6848" strokeWidth="3" />
    <path d="M465 31H512M465 45H512M559 94V148M573 94V148M338 335H390M338 349H390" fill="none" stroke="#6e9ba0" strokeWidth="4" />
    <g fill="#758078" fontFamily="sans-serif" fontSize="14" textAnchor="middle">
      <text x="174" y="150">LIVING / DINING</text><text x="174" y="170" fontSize="12">5.0 × 8.0 m</text>
      <text x="420" y="112">KITCHEN</text><text x="420" y="132" fontSize="12">7.0 × 4.0 m</text>
      <text x="348" y="258">BEDROOM</text><text x="348" y="278" fontSize="12">3.5 × 4.0 m</text>
      <text x="494" y="258">STUDY</text><text x="494" y="278" fontSize="12">3.5 × 4.0 m</text>
    </g>
    <path d="M74 366H566M74 360V372M566 360V372" stroke="#7c8580" strokeWidth="1.5" />
    <text x="320" y="375" fill="#69736d" fontFamily="sans-serif" fontSize="12" textAnchor="middle">12.0 m</text>
  </svg>
}

function ModelArtboard() {
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
  return <div className="comparison-artboard" ref={frame}>
    {nearViewport && <Suspense fallback={<div className="comparison-model-loading" aria-hidden="true" />}>
      <AnimatedModel active={visible} />
    </Suspense>}
  </div>
}

export function ComparisonPreview() {
  return <div className="comparison-visual">
    <div className="comparison-panel plan-panel-large">
      <div className="panel-label">2D PLAN</div>
      <div className="comparison-artboard"><FloorPlanPreview /></div>
    </div>
    <div className="comparison-panel model-panel-large">
      <div className="panel-label">3D FLOOR PLAN</div>
      <ModelArtboard />
    </div>
  </div>
}
