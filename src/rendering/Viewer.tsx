import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ACESFilmicToneMapping, DoubleSide, PCFShadowMap } from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { defaultRoof, type Level, type Selection } from '../domain/types'
import { WallMesh } from './WallMesh'
import { WalkController } from './WalkController'
import { RoofAssembly } from './RoofAssembly'
import { SiteEnvironment } from './SiteEnvironment'
import { zoomEvent, type ZoomDetail } from '../app/useWorkspaceZoom'
import { drawWalkMap } from './walkMap'
import { RoomSurface } from './RoomSurface'
import { SectionPlane } from './SectionPlane'
import { SoftwarePreview } from './SoftwarePreview'

function InspectionCamera({ walk, top, center, span }: { walk: boolean; top: boolean; center: [number, number, number]; span: number }) {
  const { camera, gl } = useThree()
  const controlsRef = useRef<OrbitControls | null>(null)
  const [cx, cy, cz] = center
  useFrame(() => controlsRef.current?.update())
  useEffect(() => {
    if (walk) return
    const frame = () => { camera.position.set(top ? cx : cx + span * .82, top ? span * 1.8 : span * .68, top ? cz + .001 : cz + span * 1.0); camera.lookAt(cx, cy, cz) }
    frame()
    const controls = new OrbitControls(camera, gl.domElement)
    controls.target.set(cx, cy, cz)
    controls.enableDamping = true
    controls.enableRotate = !top
    controls.enableZoom = true
    controls.minDistance = 2
    controls.maxDistance = 80
    controlsRef.current = controls
    const host = gl.domElement.closest('.viewer')
    const zoom = (event: Event) => {
      const { factor, reset } = (event as CustomEvent<ZoomDetail>).detail
      if (reset) { frame(); controls.target.set(cx, cy, cz); controls.update(); return }
      const offset = camera.position.clone().sub(controls.target)
      offset.multiplyScalar(factor || 1).clampLength(controls.minDistance, controls.maxDistance)
      camera.position.copy(controls.target).add(offset)
      controls.update()
    }
    host?.addEventListener(zoomEvent, zoom)
    return () => { host?.removeEventListener(zoomEvent, zoom); controlsRef.current = null; controls.dispose() }
  }, [walk, top, camera, gl, cx, cy, cz, span])
  return null
}
type Quality = 'performance' | 'balanced' | 'high'
function Scene({ level, selection, select, walk, top, endWalk, ceiling, roofShown, sectionHeight, quality, openDoors, toggleDoor, onWalkPosition }: {
  level: Level; selection: Selection; select: (selection: Selection) => void; walk: boolean; top: boolean; endWalk: () => void; ceiling: boolean; roofShown: boolean; quality: Quality
  sectionHeight: number | null
  openDoors: ReadonlySet<string>; toggleDoor: (id: string) => void; onWalkPosition: (x: number, z: number, yaw: number) => void
}) {
  const bounds = useMemo(() => {
    const points = level.walls.flatMap(wall => [wall.start, wall.end])
    if (!points.length) return { minX: 0, maxX: 8, minZ: 0, maxZ: 6 }
    return { minX: Math.min(...points.map(p => p.x)), maxX: Math.max(...points.map(p => p.x)), minZ: Math.min(...points.map(p => p.z)), maxZ: Math.max(...points.map(p => p.z)) }
  }, [level.walls])
  const width = Math.max(2, bounds.maxX - bounds.minX), depth = Math.max(2, bounds.maxZ - bounds.minZ)
  const ceilingHeight = Math.max(2.7, ...level.walls.map(wall => wall.height))
  const roofBounds = useMemo(() => ({ ...bounds, top: ceilingHeight }), [bounds, ceilingHeight])
  return <>
    <SectionPlane height={sectionHeight} />
    <InspectionCamera walk={walk} top={top} center={[(bounds.minX + bounds.maxX) / 2, 1.1, (bounds.minZ + bounds.maxZ) / 2]} span={Math.max(width, depth)} />
    <ambientLight intensity={.42} />
    <hemisphereLight intensity={.8} color="#f5f4eb" groundColor="#898d7d" />
    <directionalLight position={[-8, 14, 7]} intensity={2.35} castShadow={quality !== 'performance'} shadow-mapSize={quality === 'high' ? [2048, 2048] : [1024, 1024]}
      shadow-camera-left={-25} shadow-camera-right={25} shadow-camera-top={25} shadow-camera-bottom={-25}
      shadow-bias={-.00015} />
    <mesh position={[(bounds.minX + bounds.maxX) / 2, -level.slabThickness / 2, (bounds.minZ + bounds.maxZ) / 2]} receiveShadow>
      <boxGeometry args={[width + .45, level.slabThickness, depth + .45]} /><meshStandardMaterial color="#aaa9a2" roughness={.9} />
    </mesh>
    {level.rooms.map(room => <RoomSurface key={room.id} room={room} select={select} />)}
    {level.walls.map(wall => <WallMesh key={wall.id} wall={wall} doors={level.doors} windows={level.windows} passages={level.passages || []}
      selection={selection} select={select} openDoors={openDoors} />)}
    {roofShown && level.walls.length > 0 && <RoofAssembly bounds={roofBounds} roof={level.roof || defaultRoof} />}
    {(ceiling || walk) && level.rooms.length > 0 && level.rooms.map(room => <RoomSurface key={`ceiling-${room.id}`} room={room} ceiling />)}
    {(ceiling || walk) && level.rooms.length === 0 && <mesh position={[(bounds.minX + bounds.maxX) / 2, ceilingHeight + .04, (bounds.minZ + bounds.maxZ) / 2]} receiveShadow>
      <boxGeometry args={[width, .08, depth]} /><meshStandardMaterial color="#e4e1d8" roughness={.95} side={DoubleSide} />
    </mesh>}
    <SiteEnvironment bounds={roofBounds} slabThickness={level.slabThickness} />
    <WalkController level={level} active={walk} onUnlock={endWalk} openDoors={openDoors}
      onToggleDoor={toggleDoor} onPosition={onWalkPosition} />
  </>
}
export function Viewer({ level, selection, select, roofShown, setRoofShown, walkRequest = 0, presentation = false, onExitPresentation }: {
  level: Level; selection: Selection; select: (selection: Selection) => void; roofShown: boolean; setRoofShown: (value: boolean) => void
  walkRequest?: number; presentation?: boolean; onExitPresentation?: () => void
}) {
  const [walk, setWalk] = useState(false)
  const [lockedWalk, setLockedWalk] = useState(false)
  const [top, setTop] = useState(false)
  const [ceiling, setCeiling] = useState(false)
  const [sectionHeight, setSectionHeight] = useState<number | null>(null)
  const [quality, setQuality] = useState<Quality>('balanced')
  const [webglAvailable] = useState(() => {
    try { const probe = document.createElement('canvas'); const context = probe.getContext('webgl2') || probe.getContext('webgl')
      if (!context) return false
      context.getExtension('WEBGL_lose_context')?.loseContext(); return true
    } catch { return false }
  })
  const [error, setError] = useState('')
  const [openDoors, setOpenDoors] = useState<ReadonlySet<string>>(() => new Set())
  const [mapShown, setMapShown] = useState(true)
  const mapRef = useRef<HTMLCanvasElement>(null)
  const viewerRef = useRef<HTMLElement | null>(null)
  const seenWalkRequest = useRef(0)
  const zoomCamera = (detail: ZoomDetail) => viewerRef.current?.dispatchEvent(new CustomEvent<ZoomDetail>(zoomEvent, { detail }))
  const endWalk = useCallback(() => { setWalk(false); setLockedWalk(false) }, [])
  const toggleDoor = useCallback((id: string) => setOpenDoors(current => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  }), [])
  const onWalkPosition = useCallback((x: number, z: number, yaw: number) => {
    if (mapRef.current) drawWalkMap(mapRef.current, level, x, z, yaw)
  }, [level])
  const toggleWalk = useCallback(async () => {
    if (walk) { if (document.pointerLockElement) document.exitPointerLock(); endWalk(); return }
    const canvas = document.querySelector<HTMLCanvasElement>('.viewer canvas')
    try {
      if (!canvas) { setError('Walkthrough requires WebGL. The building preview and editing remain available.'); return }
      await Promise.resolve(canvas.requestPointerLock())
      setLockedWalk(document.pointerLockElement === canvas)
      setError(''); setWalk(true)
    } catch { setLockedWalk(false); setError(''); setWalk(true) }
  }, [walk, endWalk])
  useEffect(() => {
    if (walkRequest > seenWalkRequest.current) {
      seenWalkRequest.current = walkRequest
      if (!walk) {
        const frame = requestAnimationFrame(() => void toggleWalk())
        return () => cancelAnimationFrame(frame)
      }
    }
  }, [walkRequest, walk, toggleWalk])
  return <section className="viewer" ref={viewerRef}>
    <div className="viewport-head"><span>{presentation ? 'PRESENT · 3D' : '3D MODEL'}</span><div>
      {!presentation && <select aria-label="Render quality" value={quality} onChange={event => setQuality(event.target.value as Quality)}>
        <option value="performance">Performance</option><option value="balanced">Balanced</option><option value="high">High</option>
      </select>}
      <button title="Switch between overhead and orbit views" onClick={() => setTop(value => !value)}>{top ? 'Orbit' : 'Top'}</button>
      <button onClick={() => setRoofShown(!roofShown)}>{roofShown ? 'Hide roof' : 'Show roof'}</button>
      <button title="Toggle the interior ceiling" onClick={() => setCeiling(value => !value)}>{ceiling ? 'No ceiling' : 'Ceiling'}</button>
      <button aria-pressed={sectionHeight !== null} title="Cut the model horizontally to inspect the interior"
        onClick={() => setSectionHeight(value => value === null ? 1.4 : null)}>{sectionHeight === null ? 'Section' : 'Clear cut'}</button>
      {!presentation && selection?.kind === 'door' && <button onClick={() => toggleDoor(selection.id)}>
        {openDoors.has(selection.id) ? 'Close door' : 'Open door'}</button>}
      <button title="Show or hide the walkthrough minimap" onClick={() => setMapShown(value => !value)}>{mapShown ? 'Map on' : 'Map off'}</button>
      <button className="primary walk-trigger" onClick={toggleWalk}
        title="Use WASD to move. Pointer lock looks with the mouse; drag to look when it is unavailable.">
        {walk ? 'Exit walk' : 'Walk'}
      </button>
      {presentation && <button onClick={onExitPresentation}>Exit present</button>}
    </div></div>
    {error && <div className="inline-error">{error}</div>}
    <div className="canvas-wrap">{webglAvailable ? <Canvas shadows={{ type: PCFShadowMap }}
      dpr={quality === 'high' ? [1, 2] : quality === 'balanced' ? [1, 1.5] : [1, 1]}
      camera={{ fov: 55, near: .03, far: 250 }}
      gl={{ antialias: true, toneMapping: ACESFilmicToneMapping }}
      >
      <Scene level={level} selection={selection} select={select} walk={walk} top={top}
        endWalk={endWalk} ceiling={ceiling} roofShown={roofShown} sectionHeight={sectionHeight} quality={quality} openDoors={openDoors}
        toggleDoor={toggleDoor} onWalkPosition={onWalkPosition} />
    </Canvas> : <SoftwarePreview level={level} selection={selection} select={select} roofShown={roofShown}
      top={top} sectionHeight={sectionHeight} />}
      {sectionHeight !== null && <label className="section-control">Cut height · {sectionHeight.toFixed(1)} m
        <input aria-label="Section cut height" type="range" min="0.4" max="5" step="0.1" value={sectionHeight}
          onChange={event => setSectionHeight(Number(event.target.value))} />
      </label>}
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
