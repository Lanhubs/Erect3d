import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { zoomEvent, type ZoomDetail } from '../app/useWorkspaceZoom'
import { manipulationEvent } from './ElementGizmo'

export type CameraPreset = 'default' | 'exterior' | 'overview' | 'interior'
export function InspectionCamera({ walk, top, center, span, preset = 'default', sportsKind }: {
  walk: boolean; top: boolean; center: [number, number, number]; span: number;
  preset?: CameraPreset; sportsKind?: 'stadium' | 'arena' | null }) {
  const { camera, gl, invalidate } = useThree()
  const controlsRef = useRef<OrbitControls | null>(null)
  const previous = useRef<{ position: typeof camera.position; quaternion: typeof camera.quaternion; target: typeof camera.position } | null>(null), wasWalking = useRef(false)
  const [cx, cy, cz] = center
  const framing = useRef({ cx, cy, cz, span })
  useEffect(() => { framing.current = { cx, cy, cz, span } }, [cx, cy, cz, span])
  useFrame(() => controlsRef.current?.update())
  useEffect(() => {
    if (walk) { wasWalking.current = true; return }
    const frame = () => {
      const { cx, cy, cz, span } = framing.current
      const targetY = sportsKind === 'stadium' ? 3.5 : sportsKind === 'arena' ? 4 : cy
      if (top) camera.position.set(cx, span * 1.8, cz + .001)
      else if (preset === 'interior' && sportsKind === 'stadium') camera.position.set(cx + span * .18, 4.2, cz + span * .24)
      else if (preset === 'interior' && sportsKind === 'arena') camera.position.set(cx, 3.4, cz - span * .18)
      else if (preset === 'exterior') camera.position.set(cx + span * .5, span * .17,
        cz + span * (sportsKind === 'arena' ? .72 : .65))
      else if (preset === 'overview') camera.position.set(cx + span * .62, span * .69,
        cz + span * .65)
      else if (sportsKind) camera.position.set(cx + span * .55, span * .56,
        cz + span * .7)
      else camera.position.set(cx + span * .82, span * .68, cz + span * 1.0)
      camera.lookAt(cx, top ? cy : targetY, cz)
    }
    const restore = wasWalking.current ? previous.current : null
    if (restore) { camera.position.copy(restore.position); camera.quaternion.copy(restore.quaternion) } else frame()
    wasWalking.current = false
    const controls = new OrbitControls(camera, gl.domElement)
    const { cx, cy, cz, span } = framing.current
    if (restore) controls.target.copy(restore.target)
    else controls.target.set(cx, top ? cy : sportsKind ? sportsKind === 'stadium' ? 3.5 : 4 : cy, cz)
    controls.enableDamping = true; controls.enableRotate = !top; controls.enableZoom = true
    controls.minDistance = 2; controls.maxDistance = Math.max(160, span * 4)
    controlsRef.current = controls
    const changed=()=>invalidate()
    controls.addEventListener('change', changed)
    invalidate()
    const host = gl.domElement.closest('.viewer')
    const manipulate = (event: Event) => { controls.enabled = !(event as CustomEvent<boolean>).detail }
    host?.addEventListener(manipulationEvent, manipulate)
    const zoom = (event: Event) => {
      const { factor, reset } = (event as CustomEvent<ZoomDetail>).detail
      if (reset) { frame(); const { cx, cy, cz } = framing.current; controls.target.set(cx, top ? cy : sportsKind === 'stadium' ? 3.5 : sportsKind === 'arena' ? 4 : cy, cz); controls.update(); return }
      const offset = camera.position.clone().sub(controls.target)
      offset.multiplyScalar(factor || 1).clampLength(controls.minDistance, controls.maxDistance)
      camera.position.copy(controls.target).add(offset); controls.update()
    }
    host?.addEventListener(zoomEvent, zoom)
    return () => { previous.current = { position: camera.position.clone(), quaternion: camera.quaternion.clone(), target: controls.target.clone() }
      host?.removeEventListener(zoomEvent, zoom); host?.removeEventListener(manipulationEvent, manipulate); controls.removeEventListener('change', changed); controlsRef.current = null; controls.dispose() }
  }, [walk, top, camera, gl, preset, sportsKind, invalidate])
  return null
}
