import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useRef } from 'react'
import { Plane, Raycaster, Vector2, Vector3, type Group } from 'three'
import type { Building, Selection } from '../domain/types'
import { selectedElement, pointsCenter, canRotate, canAdjustHeight } from '../domain/elementGeometry'
import { useElementEditing, type EditHandle } from '../features/editing/useElementEditing'
import { useProject } from '../state/project'
import { bindDragBoundary } from '../features/editing/dragBoundary'

export const manipulationEvent = 'erect3d:manipulating'
export function ElementGizmo({
  building,
  selection,
  exploded = false,
}: {
  building: Building
  selection: Selection
  exploded?: boolean
}) {
  const { camera, gl, viewport } = useThree(),
    editing = useElementEditing()
  const target = selectedElement(building, selection)
  const tool = useProject((state) => state.tool)
  const group = useRef<Group>(null)
  useFrame(() => {
    if (!group.current || !target) return
    const pixels = gl.domElement.ownerDocument.defaultView?.matchMedia('(pointer: coarse)').matches ? 18 : 8
    const radius =
      (viewport.getCurrentViewport(camera, new Vector3(center.x, y, center.z)).width /
        Math.max(1, gl.domElement.clientWidth)) *
      pixels
    const reach = Math.max(radius * 4, baseReach)
    group.current.children.forEach((child) => {
      const key = child.name.slice(5),
        size = radius * (/^\d+$/.test(key) ? 1 : 1.4)
      child.scale.setScalar(size)
      if (key === 'rotate') child.position.z = center.z - reach
      if (key === 'scale') child.position.x = center.x + reach
      if (key === 'height') child.position.x = center.x - reach
    })
  })
  if (!target || target.level.locked || !target.points.length || tool !== 'select') return null
  const offset = exploded
    ? building.levels
        .toSorted((a, b) => a.elevation - b.elevation)
        .findIndex((item) => item.id === target.level.id) * 1.2
    : 0
  const center = pointsCenter(target.points),
    y = target.level.elevation + offset + Math.max(0.12, target.height)
  const begin = (handle: EditHandle, event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    event.nativeEvent.preventDefault()
    const host = gl.domElement.closest('.viewer') as HTMLElement
    host.focus()
    host.dispatchEvent(new CustomEvent(manipulationEvent, { detail: true }))
    const plane = new Plane(new Vector3(0, 1, 0), -y),
      raycaster = new Raycaster(),
      hit = new Vector3()
    const point = (next: { clientX: number; clientY: number }) => {
      const bounds = gl.domElement.getBoundingClientRect()
      raycaster.setFromCamera(
        new Vector2(
          ((next.clientX - bounds.left) / bounds.width) * 2 - 1,
          (-(next.clientY - bounds.top) / bounds.height) * 2 + 1,
        ),
        camera,
      )
      return raycaster.ray.intersectPlane(plane, hit) ? { x: hit.x, z: hit.z } : null
    }
    const origin = point(event)
    if (!origin) {
      host.dispatchEvent(new CustomEvent(manipulationEvent, { detail: false }))
      return
    }
    editing.start(handle, origin)
    const move = (next: PointerEvent) => {
      const p = point(next)
      if (p) editing.move(p, next.shiftKey, (event.clientY - next.clientY) * 0.01)
    }
    let releaseBoundary = () => {}
    const cleanup = () => {
      releaseBoundary()
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('keydown', keydown)
      host.dispatchEvent(new CustomEvent(manipulationEvent, { detail: false }))
    }
    const finish = () => {
      cleanup()
      editing.finish()
    }
    const cancel = () => {
      cleanup()
      editing.cancel()
    }
    const keydown = (next: KeyboardEvent) => {
      if (next.key === 'Escape') cancel()
    }
    releaseBoundary = bindDragBoundary(gl.domElement, event.pointerId, finish, cancel)
    editing.setCleanup(cleanup)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', finish, { once: true })
    window.addEventListener('pointercancel', cancel, { once: true })
    window.addEventListener('keydown', keydown)
  }
  const baseReach = Math.max(
    0.55,
    Math.min(1.5, Math.max(...target.points.map((p) => Math.hypot(p.x - center.x, p.z - center.z))) * 0.3),
  )
  const handle = (key: EditHandle, x: number, z: number, color: string) => (
    <mesh
      key={String(key)}
      name={`edit:${key}`}
      position={[x, y + 0.12, z]}
      renderOrder={100}
      onPointerDown={(event) => begin(key, event)}
      onPointerOver={() => {
        gl.domElement.style.cursor = 'grab'
      }}
      onPointerOut={() => {
        gl.domElement.style.cursor = ''
      }}
    >
      <sphereGeometry args={[1, 16, 12]} />
      <meshBasicMaterial color={color} depthTest={false} transparent opacity={0.95} />
    </mesh>
  )
  return (
    <group ref={group}>
      {selection?.kind !== 'column' &&
        selection?.kind !== 'stair' &&
        target.points.map((p, i) => handle(i, p.x, p.z, '#2477ae'))}
      {handle('move', center.x, center.z, '#2477ae')}
      {canRotate(selection) && handle('rotate', center.x, center.z - baseReach, '#80639e')}
      {handle('scale', center.x + baseReach, center.z, '#488363')}
      {canAdjustHeight(selection) && handle('height', center.x - baseReach, center.z, '#b27837')}
    </group>
  )
}
