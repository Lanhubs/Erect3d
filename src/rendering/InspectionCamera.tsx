import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { zoomEvent, type ZoomDetail } from '../app/useWorkspaceZoom'

export function InspectionCamera({ walk, top, center, span }: { walk: boolean; top: boolean; center: [number, number, number]; span: number }) {
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
    controls.enableDamping = true; controls.enableRotate = !top; controls.enableZoom = true
    controls.minDistance = 2; controls.maxDistance = 160
    controlsRef.current = controls
    const host = gl.domElement.closest('.viewer')
    const zoom = (event: Event) => {
      const { factor, reset } = (event as CustomEvent<ZoomDetail>).detail
      if (reset) { frame(); controls.target.set(cx, cy, cz); controls.update(); return }
      const offset = camera.position.clone().sub(controls.target)
      offset.multiplyScalar(factor || 1).clampLength(controls.minDistance, controls.maxDistance)
      camera.position.copy(controls.target).add(offset); controls.update()
    }
    host?.addEventListener(zoomEvent, zoom)
    return () => { host?.removeEventListener(zoomEvent, zoom); controlsRef.current = null; controls.dispose() }
  }, [walk, top, camera, gl, cx, cy, cz, span])
  return null
}
