import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { InstancedMesh, Object3D, type BufferGeometry } from 'three'
import type { Selection } from '../domain/types'
import { useRenderResources, type InstanceShape } from './RenderResources'
import { pointerCursor } from './pointerCursor'
import { useInstanceVisibility } from './InstanceVisibility'
export type InstancePart = {
  center: [number, number, number]
  size: [number, number, number]
  rotation: number
  slope?: number
  selection?: NonNullable<Selection>
  color?: string
}
export function spatialBatches(parts: InstancePart[], cell = 24) {
  const zones = new Map<string, InstancePart[]>()
  for (const part of parts) {
    const key = `${Math.floor(part.center[0] / cell)}:${Math.floor(part.center[1] / cell)}:${Math.floor(part.center[2] / cell)}`
    const zone = zones.get(key) || []
    zone.push(part)
    zones.set(key, zone)
  }
  return zones
}
export const EntityInstances = memo(function EntityInstances({
  parts,
  color,
  material = 'solid',
  shape = 'box',
  geometry: providedGeometry,
  select,
  shadow = true,
}: {
  parts: InstancePart[]
  color: string
  material?: string
  shape?: InstanceShape
  geometry?: BufferGeometry
  select?: (selection: Selection) => void
  shadow?: boolean
}) {
  const resources = useRenderResources(),
    mesh = useRef<InstancedMesh>(null),
    previous = useRef<{ mesh: InstancedMesh | null; parts: InstancePart[] }>({ mesh: null, parts: [] })
  useInstanceVisibility(mesh)
  const geometry = providedGeometry || resources.geometry(shape),
    surface = resources.material(material, color)
  useEffect(() => {
    resources.retain(surface)
    return () => resources.release(surface)
  }, [resources, surface])
  const capacity = useMemo(() => 2 ** Math.ceil(Math.log2(Math.max(1, parts.length))), [parts.length])
  useEffect(() => {
    const target = mesh.current
    return () => target?.dispose()
  }, [capacity, geometry])
  useLayoutEffect(() => {
    const target = mesh.current
    if (!target) return
    const old = previous.current,
      transform = new Object3D(),
      all = old.mesh !== target
    target.count = parts.length
    parts.forEach((part, index) => {
      if (!all && old.parts[index] === part) return
      transform.position.set(...part.center)
      transform.rotation.set(0, part.rotation, part.slope || 0)
      transform.scale.set(...part.size)
      transform.updateMatrix()
      target.setMatrixAt(index, transform.matrix)
      target.instanceMatrix.addUpdateRange(index * 16, 16)
    })
    if (target.instanceMatrix.updateRanges.length) target.instanceMatrix.needsUpdate = true
    target.computeBoundingSphere()
    previous.current = { mesh: target, parts }
    target.userData.boundsVersion = (target.userData.boundsVersion || 0) + 1
    target.userData.entityIds = parts.map((part) => part.selection?.id)
    resources.shadowEpoch++
  }, [parts, capacity, geometry])
  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, undefined, capacity]}
      material={surface}
      dispose={null}
      castShadow={shadow}
      receiveShadow
      onPointerOver={
        select
          ? (event) => {
              event.stopPropagation()
              pointerCursor(true)
            }
          : undefined
      }
      onPointerOut={select ? () => pointerCursor(false) : undefined}
      onClick={
        select
          ? (event) => {
              const selection = parts[event.instanceId ?? -1]?.selection
              if (selection) {
                event.stopPropagation()
                select(selection)
              }
            }
          : undefined
      }
    />
  )
})
