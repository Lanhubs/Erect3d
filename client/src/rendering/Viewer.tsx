import { memo, useCallback, useState } from 'react'
import { sportsCategory, viewerBounds } from './viewerBounds'
import { useRenderPreference } from '../state/renderPreference'
import { useRendererStartup } from './useRendererStartup'
import { useViewerDisplay } from './useViewerDisplay'
import { useViewerInteractions } from './useViewerInteractions'
import { useWalkSession } from './useWalkSession'
import { ViewerCanvas } from './ViewerCanvas'
import { ViewerOverlays } from './ViewerOverlays'
import { ViewerToolbar } from './ViewerToolbar'
import { useFurnitureReview } from '../furniture/reviewState'
import { type RendererChoice } from './graphicsRenderer'
import type { GraphicsSnapshot } from './GraphicsRuntime'
import type { Building, Selection } from '../domain/types'

function ViewerComponent({
  building,
  activeLevelId,
  isolateId = null,
  selection,
  select,
  roofShown,
  setRoofShown,
  walkRequest = 0,
  presentation = false,
  onExitPresentation,
  benchmark,
  active = true,
  onWalkChange,
  previewOnly = false,
  wholeBuildingRequest,
}: {
  building: Building
  activeLevelId: string
  isolateId?: string | null
  selection: Selection
  select: (selection: Selection) => void
  roofShown: boolean
  setRoofShown: (value: boolean) => void
  walkRequest?: number
  presentation?: boolean
  onExitPresentation?: () => void
  active?: boolean
  onWalkChange?: (walking: boolean) => void
  previewOnly?: boolean
  wholeBuildingRequest?: string
  benchmark?: {
    renderer: RendererChoice
    optimized: boolean
    continuous?: boolean
    probe?: boolean
    minimal?: boolean
    report?: (snapshot: GraphicsSnapshot) => void
  }
}) {
  const level = building.levels.find((item) => item.id === activeLevelId) || building.levels[0]
  const display = useViewerDisplay({
    benchmark: Boolean(benchmark),
    building,
    wholeBuildingRequest,
  })
  const { mapRef, viewpoint, ...walk } = useWalkSession({
    onWalkChange,
    selection,
    setSectionHeight: display.setSectionHeight,
    setVerticalSection: display.setVerticalSection,
    walkRequest,
  })
  const furnitureShown = useFurnitureReview((state) => state.shown),
    toggleFurniture = useFurnitureReview((state) => state.toggle)
  const preference = useRenderPreference((state) => state.renderer),
    rendererChoice = benchmark?.renderer || preference
  const startup = useRendererStartup(rendererChoice),
    canvasKey = startup.key
  const rendererFactory = startup.factory
  const [openDoors, setOpenDoors] = useState<ReadonlySet<string>>(() => new Set())
  const toggleDoor = useCallback(
    (id: string) =>
      setOpenDoors((current) => {
        const next = new Set(current)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      }),
    [],
  )
  const { viewerRef, ...interactions } = useViewerInteractions({
    active,
    presentation,
    previewOnly,
    select,
    walk: walk.walk,
  })
  const frames =
    interactions.visible && !startup.failed
      ? walk.walk || benchmark?.continuous
        ? 'always'
        : 'demand'
      : 'never'
  const bounds = viewerBounds(building)
  const sportsKind = sportsCategory(building)
  return (
    <section
      className="viewer"
      ref={viewerRef}
      tabIndex={0}
      aria-label="Editable 3D building"
      onKeyDown={interactions.editing.keyboard}
      onPointerDownCapture={(event) => {
        if (!(event.target as HTMLElement).closest('button,input,select')) viewerRef.current?.focus()
      }}
    >
      <ViewerToolbar
        bounds={bounds}
        building={building}
        display={display}
        furnitureShown={furnitureShown}
        onExitPresentation={onExitPresentation}
        openDoors={openDoors}
        presentation={presentation}
        roofShown={roofShown}
        selection={selection}
        setRoofShown={setRoofShown}
        sportsKind={sportsKind}
        toggleDoor={toggleDoor}
        toggleFurniture={toggleFurniture}
        viewpoint={viewpoint}
        walk={walk}
      />
      {walk.error && <div className="inline-error">{walk.error}</div>}
      {interactions.sceneIssues && (
        <div className="inline-error" role="alert">
          {interactions.sceneIssues}
        </div>
      )}
      <div className="canvas-wrap">
        <ViewerCanvas
          benchmark={benchmark}
          building={building}
          activeLevelId={activeLevelId}
          canvasKey={canvasKey}
          display={display}
          frames={frames}
          clearSelection={interactions.clearSelection}
          visible={interactions.visible}
          isolateId={isolateId}
          level={level}
          openDoors={openDoors}
          rendererFactory={rendererFactory}
          roofShown={roofShown}
          selection={selection}
          select={select}
          startup={startup}
          toggleDoor={toggleDoor}
          walk={walk}
        />
        <ViewerOverlays
          bounds={bounds}
          display={display}
          mapRef={mapRef}
          walk={walk}
          zoomCamera={interactions.zoomCamera}
        />
      </div>
      <div
        className={`viewport-foot${interactions.editing.message ? ' viewport-feedback' : ''}`}
        role="status"
      >
        {walk.walk
          ? `${walk.walkLevel || level.name} · W A S D move · Shift faster · ${
              walk.lockedWalk
                ? 'Mouse look · Esc release'
                : walk.dragWalk
                  ? 'Drag to look · Esc pause'
                  : 'Click to explore'
            } · E open/close door`
          : interactions.editing.message ||
            (selection
              ? 'Handles: blue move/reshape · purple rotate · green resize · amber height · Arrows move · Shift fine · Esc cancel'
              : 'Drag rotate · Right drag pan · Scroll or pinch zoom · Ctrl + / − zoom · Ctrl + 0 fit')}
      </div>
    </section>
  )
}
// Sync indicators and drawers update outside the canvas. Keep their renders from
// submitting an unchanged scene or interrupting an idle navigation controller.
export const Viewer = memo(ViewerComponent)
