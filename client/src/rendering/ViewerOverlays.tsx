import type { RefObject } from 'react'
import type { viewerBounds } from './viewerBounds'
import type { useViewerDisplay } from './useViewerDisplay'
import type { WalkSession } from './useWalkSession'
import type { ZoomDetail } from '../app/useWorkspaceZoom'

/** The controls drawn over the viewport: section cuts, minimap, entry hint and zoom. */
export function ViewerOverlays({
  bounds,
  display,
  mapRef,
  walk,
  zoomCamera,
}: {
  bounds: ReturnType<typeof viewerBounds>
  display: ReturnType<typeof useViewerDisplay>
  mapRef: RefObject<HTMLCanvasElement | null>
  walk: WalkSession
  zoomCamera: (detail: ZoomDetail) => void
}) {
  return (
    <>
      {display.sectionHeight !== null && (
        <label className="section-control">
          Cut height · {display.sectionHeight.toFixed(1)} m
          <input
            aria-label="Section cut height"
            type="range"
            min="0.4"
            max={bounds.maxHeight}
            step="0.1"
            value={display.sectionHeight}
            onChange={(event) => display.setSectionHeight(Number(event.target.value))}
          />
        </label>
      )}
      {display.verticalSection !== null && (
        <label className="section-control vertical-control">
          Vertical cut · {display.verticalSection.toFixed(1)} m
          <input
            aria-label="Vertical section position"
            type="range"
            min={bounds.minX}
            max={bounds.maxX}
            step="0.1"
            value={display.verticalSection}
            onChange={(event) => display.setVerticalSection(Number(event.target.value))}
          />
        </label>
      )}
      {walk.walk && display.mapShown && (
        <canvas ref={mapRef} className="walk-map" width="170" height="145" aria-label="Walkthrough minimap" />
      )}
      {walk.walk && !walk.lockedWalk && !walk.dragWalk && (
        <div className="walk-entry-hint">
          Click the model to explore · WASD move · Mouse look · E open door · Esc release
        </div>
      )}
      {!walk.walk && (
        <div className="viewer-zoom" aria-label="3D view zoom controls">
          <button
            type="button"
            aria-label="Zoom in"
            data-tooltip="Zoom in"
            onClick={() => zoomCamera({ factor: 0.8 })}
          >
            +
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            data-tooltip="Zoom out"
            onClick={() => zoomCamera({ factor: 1.25 })}
          >
            −
          </button>
          <button
            type="button"
            aria-label="Fit model"
            data-tooltip="Fit model"
            onClick={() => zoomCamera({ reset: true })}
          >
            Fit
          </button>
        </div>
      )}
    </>
  )
}
