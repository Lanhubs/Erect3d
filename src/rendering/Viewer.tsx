import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ACESFilmicToneMapping, PCFSoftShadowMap } from 'three'
import { PerspectiveCamera } from 'three'
import type { Building, Level, Selection } from '../domain/types'
import { zoomEvent, type ZoomDetail } from '../app/useWorkspaceZoom'
import { drawWalkMap } from './walkMap'
import { SoftwarePreview } from './SoftwarePreview'
import { BuildingScene, type BuildingView } from './BuildingScene'
import type { CameraPreset } from './InspectionCamera'
import { wallBoundsPoints } from '../geometry/math'

function CanvasSizeSync() {
  const { camera, gl } = useThree()
  const resizeRef = useRef<() => void>(() => {})
  useLayoutEffect(() => {
    const host = gl.domElement.closest('.canvas-wrap')
    if (!host) return
    const resize = () => {
      const { width, height } = host.getBoundingClientRect()
      if (width < 1 || height < 1) return
      gl.domElement.dataset.sizeSync = `${Math.round(width)}x${Math.round(height)}`
      gl.setSize(Math.round(width), Math.round(height), false)
      if (camera instanceof PerspectiveCamera) {
        camera.aspect = width / height
        camera.updateProjectionMatrix()
      }
    }
    resizeRef.current = resize
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    return () => { observer.disconnect(); resizeRef.current = () => {} }
  }, [camera, gl])
  useFrame(() => resizeRef.current())
  return null
}

export function Viewer({ building, activeLevelId, isolateId = null, selection, select, roofShown, setRoofShown,
  walkRequest = 0, presentation = false, onExitPresentation }: {
  building: Building; activeLevelId: string; isolateId?: string | null; selection: Selection;
  select: (selection: Selection) => void; roofShown: boolean; setRoofShown: (value: boolean) => void;
  walkRequest?: number; presentation?: boolean; onExitPresentation?: () => void
}) {
  const level = building.levels.find(item => item.id === activeLevelId) || building.levels[0]
  const [walk, setWalk] = useState(false), [lockedWalk, setLockedWalk] = useState(false)
  const [top, setTop] = useState(false), [ceiling, setCeiling] = useState(false)
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('default')
  const [buildingView, setBuildingView] = useState<BuildingView>(building.levels.length > 1 ? 'building' : 'current')
  const previousLevelCount = useRef(building.levels.length)
  const [sectionHeight, setSectionHeight] = useState<number | null>(null), [verticalSection, setVerticalSection] = useState<number | null>(null)
  const [quality, setQuality] = useState<'auto' | 'performance' | 'balanced' | 'high'>('auto')
  const [webglAvailable] = useState(() => {
    try { const probe = document.createElement('canvas'); const context = probe.getContext('webgl2') || probe.getContext('webgl')
      if (!context) return false
      context.getExtension('WEBGL_lose_context')?.loseContext(); return true
    } catch { return false }
  })
  const [error, setError] = useState(''), [openDoors, setOpenDoors] = useState<ReadonlySet<string>>(() => new Set())
  const [mapShown, setMapShown] = useState(true)
  const mapRef = useRef<HTMLCanvasElement>(null), viewerRef = useRef<HTMLElement | null>(null), seenWalkRequest = useRef(0)
  useEffect(() => {
    if (building.levels.length > previousLevelCount.current) setBuildingView('building')
    previousLevelCount.current = building.levels.length
  }, [building.levels.length])
  const zoomCamera = (detail: ZoomDetail) => viewerRef.current?.dispatchEvent(new CustomEvent<ZoomDetail>(zoomEvent, { detail }))
  const endWalk = useCallback(() => { setWalk(false); setLockedWalk(false) }, [])
  const toggleDoor = useCallback((id: string) => setOpenDoors(current => {
    const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next
  }), [])
  const onWalkPosition = useCallback((x: number, z: number, yaw: number, current: Level) => {
    if (mapRef.current) drawWalkMap(mapRef.current, current, x, z, yaw)
  }, [])
  const toggleWalk = useCallback(async () => {
    if (walk) { if (document.pointerLockElement) document.exitPointerLock(); endWalk(); return }
    const canvas = document.querySelector<HTMLCanvasElement>('.viewer canvas')
    try {
      if (!canvas) { setError('Walkthrough requires WebGL. The building preview and editing remain available.'); return }
      await Promise.resolve(canvas.requestPointerLock())
      setLockedWalk(document.pointerLockElement === canvas); setError(''); setWalk(true)
    } catch { setLockedWalk(false); setError(''); setWalk(true) }
  }, [walk, endWalk])
  useEffect(() => {
    if (walkRequest > seenWalkRequest.current) {
      seenWalkRequest.current = walkRequest
      if (!walk) { const frame = requestAnimationFrame(() => void toggleWalk()); return () => cancelAnimationFrame(frame) }
    }
  }, [walkRequest, walk, toggleWalk])
  const allHeights = building.levels.map(item => item.elevation + (item.floorToFloorHeight || 3))
  const maxHeight = Math.max(5, ...allHeights)
  const xPoints = building.levels.flatMap(item => wallBoundsPoints(item.walls).map(point => point.x))
  const minX = Math.min(0, ...xPoints), maxX = Math.max(8, ...xPoints)
  const sportsKind = building.levels.some(item => item.rooms.some(room => room.category === 'football-pitch')) ? 'stadium'
    : building.levels.some(item => item.rooms.some(room => room.category === 'table-tennis-hall')) ? 'arena' : null
  return <section className="viewer" ref={viewerRef}>
    <div className="viewport-head"><span>{presentation ? 'PRESENT · 3D' : '3D MODEL'}</span><div>
      <button className="primary walk-trigger" onClick={toggleWalk} title="Use WASD to move. Drag or lock the pointer to look around.">
        {walk ? 'Exit walk' : 'Walk'}</button>
      <button title="Switch between overhead and orbit views" onClick={() => setTop(value => !value)}>{top ? 'Orbit' : 'Top'}</button>
      <button onClick={() => setRoofShown(!roofShown)}>{roofShown ? 'Hide roof' : 'Show roof'}</button>
      <details className="view-options"><summary>View options</summary><div>
      {!presentation && <select aria-label="Render quality" value={quality} onChange={event => setQuality(event.target.value as typeof quality)}>
        <option value="auto">Auto</option><option value="performance">Performance</option><option value="balanced">Balanced</option><option value="high">High</option>
      </select>}
      <select aria-label="Building view" value={buildingView} onChange={event => setBuildingView(event.target.value as BuildingView)}>
        <option value="current">Current level</option><option value="building">Entire building</option><option value="exploded">Exploded view</option>
      </select>
      {sportsKind && <select aria-label="Camera view" value={top ? 'top' : cameraPreset}
        onChange={event => { const value = event.target.value; setTop(value === 'top');
          if (value !== 'top') setCameraPreset(value as CameraPreset) }}>
        <option value="default">Default view</option><option value="exterior">Exterior hero</option>
        <option value="overview">Elevated overview</option>
        <option value="interior">{sportsKind === 'stadium' ? 'Pitch-side interior' : 'Hall interior'}</option>
        <option value="top">Top / open roof</option>
      </select>}
      <button title="Toggle the interior ceiling" onClick={() => setCeiling(value => !value)}>{ceiling ? 'No ceiling' : 'Ceiling'}</button>
      <button aria-pressed={sectionHeight !== null} title="Cut the model horizontally" onClick={() => setSectionHeight(value => value === null ? 1.4 : null)}>
        {sectionHeight === null ? 'Horizontal cut' : 'Clear H cut'}</button>
      <button aria-pressed={verticalSection !== null} title="Cut the model vertically" onClick={() => setVerticalSection(value => value === null ? (minX + maxX) / 2 : null)}>
        {verticalSection === null ? 'Vertical cut' : 'Clear V cut'}</button>
      {!presentation && selection?.kind === 'door' && <button onClick={() => toggleDoor(selection.id)}>
        {openDoors.has(selection.id) ? 'Close door' : 'Open door'}</button>}
      <button title="Show or hide the walkthrough minimap" onClick={() => setMapShown(value => !value)}>{mapShown ? 'Map on' : 'Map off'}</button>
      </div></details>
      {presentation && <button onClick={onExitPresentation}>Exit present</button>}
    </div></div>
    {error && <div className="inline-error">{error}</div>}
    <div className="canvas-wrap">{webglAvailable ? <Canvas shadows={{ type: PCFSoftShadowMap }}
      dpr={quality === 'high' ? [1, 2] : quality === 'balanced' || quality === 'auto' ? [1, 1.5] : [1, 1]}
      camera={{ fov: 55, near: .03, far: 1000 }} gl={{ antialias: true, toneMapping: ACESFilmicToneMapping }}>
      <CanvasSizeSync />
      <BuildingScene building={building} activeLevelId={activeLevelId} view={buildingView} isolateId={isolateId}
        selection={selection} select={select} walk={walk} top={top} endWalk={endWalk} ceiling={ceiling}
        roofShown={roofShown} sectionHeight={sectionHeight} verticalSection={verticalSection} quality={quality}
        openDoors={openDoors} toggleDoor={toggleDoor} onWalkPosition={onWalkPosition} cameraPreset={cameraPreset} />
    </Canvas> : <SoftwarePreview level={level} selection={selection} select={select} roofShown={roofShown}
      top={top} sectionHeight={sectionHeight} />}
      {sectionHeight !== null && <label className="section-control">Cut height · {sectionHeight.toFixed(1)} m
        <input aria-label="Section cut height" type="range" min="0.4" max={maxHeight} step="0.1" value={sectionHeight}
          onChange={event => setSectionHeight(Number(event.target.value))} /></label>}
      {verticalSection !== null && <label className="section-control vertical-control">Vertical cut · {verticalSection.toFixed(1)} m
        <input aria-label="Vertical section position" type="range" min={minX} max={maxX} step="0.1" value={verticalSection}
          onChange={event => setVerticalSection(Number(event.target.value))} /></label>}
      {walk && mapShown && <canvas ref={mapRef} className="walk-map" width="170" height="145" aria-label="Walkthrough minimap" />}
      {!walk && <div className="viewer-zoom" aria-label="3D view zoom controls">
        <button type="button" aria-label="Zoom in" title="Zoom in" onClick={() => zoomCamera({ factor: .8 })}>+</button>
        <button type="button" aria-label="Zoom out" title="Zoom out" onClick={() => zoomCamera({ factor: 1.25 })}>−</button>
        <button type="button" aria-label="Fit model" title="Fit model" onClick={() => zoomCamera({ reset: true })}>Fit</button>
      </div>}
    </div>
    <div className="viewport-foot">{walk
      ? `W A S D move · ${lockedWalk ? 'Mouse look · Esc release' : 'Drag to look · Exit walk to leave'} · E open/close nearby door`
      : 'Drag rotate · Right drag pan · Scroll or pinch zoom · Ctrl + / − zoom · Ctrl + 0 fit'}</div>
  </section>
}
