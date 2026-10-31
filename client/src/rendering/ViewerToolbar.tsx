import { WalkControls } from '../walkthrough/WalkControls'
import { ViewportOptions } from './ViewportOptions'
import type { RefObject } from 'react'
import type { Building, Selection } from '../domain/types'
import type { BuildingView } from './BuildingScene'
import type { CameraPreset } from './InspectionCamera'
import type { viewerBounds } from './viewerBounds'
import type { useViewerDisplay, ViewerQuality } from './useViewerDisplay'
import type { WalkSession } from './useWalkSession'
import type { WalkViewpoint } from '../walkthrough/types'

export function ViewerToolbar({
  bounds,
  building,
  display,
  furnitureShown,
  onExitPresentation,
  openDoors,
  presentation,
  roofShown,
  selection,
  setRoofShown,
  sportsKind,
  toggleDoor,
  toggleFurniture,
  viewpoint,
  walk,
}: {
  bounds: ReturnType<typeof viewerBounds>
  building: Building
  display: ReturnType<typeof useViewerDisplay>
  furnitureShown: boolean
  onExitPresentation?: () => void
  openDoors: ReadonlySet<string>
  presentation: boolean
  roofShown: boolean
  selection: Selection
  setRoofShown: (value: boolean) => void
  sportsKind: 'stadium' | 'arena' | null
  toggleDoor: (id: string) => void
  toggleFurniture: () => void
  viewpoint: RefObject<WalkViewpoint | null>
  walk: WalkSession
}) {
  return (
    <div className="viewport-head">
      <span>{presentation ? 'PRESENT · 3D' : '3D MODEL'}</span>
      <div>
        <button
          className="primary walk-trigger"
          onClick={walk.toggleWalk}
          data-tooltip="Use WASD to move. Drag or lock the pointer to look around."
        >
          {walk.walk ? 'Exit walk' : 'Walk'}
        </button>
        <button
          disabled={walk.walk}
          data-tooltip="Switch between overhead and orbit views"
          onClick={() => display.setTop((value) => !value)}
        >
          {display.top ? 'Orbit' : 'Top'}
        </button>
        <button onClick={() => setRoofShown(!roofShown)}>{roofShown ? 'Hide roof' : 'Show roof'}</button>
        <ViewportOptions>
          <WalkControls
            building={building}
            options={walk.walkOptions}
            setOptions={walk.setWalkOptions}
            active={walk.walk}
            current={walk.walkLevel}
            savePoint={() => viewpoint.current}
          />
          <button aria-pressed={furnitureShown} onClick={toggleFurniture}>
            Furniture {furnitureShown ? 'on' : 'off'}
          </button>
          {building.architecture && (
            <button
              aria-pressed={display.roofCutaway}
              onClick={() => display.setRoofCutaway((value) => !value)}
            >
              {display.roofCutaway ? 'Show full roof' : 'Roof cutaway'}
            </button>
          )}
          {!presentation && (
            <select
              aria-label="Render quality"
              value={display.quality}
              onChange={(event) => display.setQuality(event.target.value as ViewerQuality)}
            >
              <option value="auto">Auto</option>
              <option value="performance">Performance</option>
              <option value="balanced">Balanced</option>
              <option value="high">High</option>
            </select>
          )}
          <select
            aria-label="Building view"
            value={display.buildingView}
            onChange={(event) => display.setBuildingView(event.target.value as BuildingView)}
          >
            <option value="current">Current level</option>
            <option value="building">Entire building</option>
            <option value="exploded">Exploded view</option>
          </select>
          {sportsKind && (
            <select
              aria-label="Camera view"
              value={display.top ? 'top' : display.cameraPreset}
              onChange={(event) => {
                const value = event.target.value
                display.setTop(value === 'top')
                if (value !== 'top') display.setCameraPreset(value as CameraPreset)
              }}
            >
              <option value="default">Default view</option>
              <option value="exterior">Exterior hero</option>
              <option value="overview">Elevated overview</option>
              <option value="interior">
                {sportsKind === 'stadium' ? 'Pitch-side interior' : 'Hall interior'}
              </option>
              <option value="top">Top / open roof</option>
            </select>
          )}
          <button
            aria-pressed={display.contextShown}
            data-tooltip="Illustrative parking and planting, separate from the imported plan"
            onClick={() => display.setContextShown((value) => !value)}
          >
            {display.contextShown ? 'Hide surroundings' : 'Show surroundings'}
          </button>
          <button
            data-tooltip="Toggle the interior ceiling"
            onClick={() => display.setCeiling((value) => !value)}
          >
            {display.ceiling ? 'No ceiling' : 'Ceiling'}
          </button>
          <button
            aria-pressed={display.sectionHeight !== null}
            data-tooltip="Cut the model horizontally"
            onClick={() => display.setSectionHeight((value) => (value === null ? 1.4 : null))}
          >
            {display.sectionHeight === null ? 'Horizontal cut' : 'Clear H cut'}
          </button>
          <button
            aria-pressed={display.verticalSection !== null}
            data-tooltip="Cut the model vertically"
            onClick={() =>
              display.setVerticalSection((value) => (value === null ? (bounds.minX + bounds.maxX) / 2 : null))
            }
          >
            {display.verticalSection === null ? 'Vertical cut' : 'Clear V cut'}
          </button>
          {!presentation && selection?.kind === 'door' && (
            <button onClick={() => toggleDoor(selection.id)}>
              {openDoors.has(selection.id) ? 'Close door' : 'Open door'}
            </button>
          )}
          <button
            data-tooltip="Show or hide the walkthrough minimap"
            onClick={() => display.setMapShown((value) => !value)}
          >
            {display.mapShown ? 'Map on' : 'Map off'}
          </button>
        </ViewportOptions>
        {presentation && <button onClick={onExitPresentation}>Exit present</button>}
      </div>
    </div>
  )
}
