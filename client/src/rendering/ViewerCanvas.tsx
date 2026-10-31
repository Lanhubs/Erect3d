import { Canvas } from '@react-three/fiber'
import { PCFShadowMap } from 'three'
import { BuildingScene } from './BuildingScene'
import { CanvasSizeSync } from './CanvasSizeSync'
import { GraphicsRuntime, type GraphicsSnapshot } from './GraphicsRuntime'
import { RendererBoundary } from './RendererBoundary'
import { SoftwarePreview } from './SoftwarePreview'
import type { RendererChoice } from './graphicsRenderer'
import type { useRendererStartup } from './useRendererStartup'
import type { useViewerDisplay } from './useViewerDisplay'
import type { WalkSession } from './useWalkSession'
import type { Building, Level, Selection } from '../domain/types'

export function ViewerCanvas({
  benchmark,
  building,
  activeLevelId,
  canvasKey,
  display,
  frames,
  clearSelection,
  visible,
  isolateId = null,
  level,
  openDoors,
  rendererFactory,
  roofShown,
  selection,
  select,
  startup,
  toggleDoor,
  walk,
}: {
  benchmark?: {
    renderer: RendererChoice
    optimized: boolean
    continuous?: boolean
    probe?: boolean
    minimal?: boolean
    report?: (snapshot: GraphicsSnapshot) => void
  }
  building: Building
  activeLevelId: string
  canvasKey: string
  display: ReturnType<typeof useViewerDisplay>
  frames: 'always' | 'demand' | 'never'
  clearSelection: (event: MouseEvent) => void
  visible: boolean
  isolateId?: string | null
  level: Level
  openDoors: ReadonlySet<string>
  rendererFactory: ReturnType<typeof useRendererStartup>['factory']
  roofShown: boolean
  selection: Selection
  select: (selection: Selection) => void
  startup: ReturnType<typeof useRendererStartup>
  toggleDoor: (id: string) => void
  walk: WalkSession
}) {
  const report = (snapshot: GraphicsSnapshot) => {
    benchmark?.report?.(snapshot)
  }
  return (
    <>
      {startup.waiting}
      {walk.webglAvailable ? (
        <RendererBoundary key={canvasKey} fallback={startup.recover}>
          <Canvas
            shadows={{ type: PCFShadowMap }}
            dpr={display.renderDpr}
            key={canvasKey}
            frameloop={frames}
            camera={{ fov: 55, near: 0.03, far: 1000 }}
            gl={rendererFactory}
            onPointerMissed={clearSelection}
          >
            <CanvasSizeSync />
            <GraphicsRuntime
              mode={display.quality}
              optimized={benchmark?.optimized ?? true}
              fixedDpr={benchmark?.continuous ? 1 : undefined}
              sampleAll={benchmark?.continuous}
              onResolution={display.setRenderDpr}
              onPrepared={startup.prepared}
              onFailure={startup.failure}
              report={import.meta.env.DEV ? report : undefined}
            >
              {import.meta.env.DEV && benchmark?.minimal ? (
                <>
                  <ambientLight intensity={2} />
                  <mesh>
                    <boxGeometry />
                    <meshStandardMaterial color="#668c7b" />
                  </mesh>
                </>
              ) : (
                <BuildingScene
                  building={building}
                  activeLevelId={activeLevelId}
                  view={display.buildingView}
                  isolateId={isolateId}
                  selection={selection}
                  select={select}
                  walk={walk.walk}
                  active={visible}
                  top={display.top}
                  ceiling={display.ceiling}
                  roofShown={roofShown}
                  roofCutaway={display.roofCutaway}
                  sectionHeight={display.sectionHeight}
                  verticalSection={display.verticalSection}
                  quality={display.quality}
                  contextShown={display.contextShown}
                  openDoors={openDoors}
                  toggleDoor={toggleDoor}
                  onWalkPosition={walk.onWalkPosition}
                  cameraPreset={display.cameraPreset}
                  walkOptions={walk.controllerOptions}
                  onCapture={walk.onCapture}
                  probe={benchmark?.probe}
                />
              )}
            </GraphicsRuntime>
          </Canvas>
        </RendererBoundary>
      ) : (
        <SoftwarePreview
          key={`${level.id}:${display.top}`}
          level={level}
          levels={building.levels}
          building={building}
          selection={selection}
          select={select}
          roofShown={roofShown}
          top={display.top}
          sectionHeight={display.sectionHeight}
        />
      )}
    </>
  )
}
