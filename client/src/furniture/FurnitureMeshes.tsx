import { useLayoutEffect, useMemo, useRef } from 'react'
import { type Matrix4, type InstancedMesh } from 'three'
import type { Level, Selection } from '../domain/types'
import { furnitureParts, type FurniturePart } from './assets'
import { useFurnitureReview } from './reviewState'
import {materialKey} from './resources'
import {useRenderResources} from '../rendering/RenderResources'
import {geometryKey} from './geometry'
import {partTransform} from './partTransform'
type Instance = { id: string; matrix: Matrix4 }
function Batch({ part, instances, select }: { part: FurniturePart; instances: Instance[]; select: (selection: Selection) => void }) {
  const mesh = useRef<InstancedMesh>(null)
  const resources=useRenderResources().furniture
  const geometry=resources.geometry(part),material=resources.material(part)
  useLayoutEffect(()=>{resources.retain(part);return()=>resources.release(part)},[resources,part])
  useLayoutEffect(() => {
    instances.forEach((instance, i) => mesh.current!.setMatrixAt(i, instance.matrix))
    mesh.current!.instanceMatrix.needsUpdate = true; mesh.current!.computeBoundingSphere()
  }, [instances])
  return <instancedMesh ref={mesh} args={[geometry, material, instances.length]} dispose={null} castShadow receiveShadow frustumCulled
    onClick={event => { event.stopPropagation(); if (event.instanceId !== undefined) select({ kind: 'furniture', id: instances[event.instanceId].id }) }}>
  </instancedMesh>
}
export function FurnitureMeshes({ level, selection, select }: { level: Level; selection: Selection; select: (selection: Selection) => void }) {
  const shown = useFurnitureReview(state => state.shown)
  const batches = useMemo(() => {
    const groups = new Map<string, { part: FurniturePart; instances: Instance[] }>()
    for (const object of level.furniture || []) {
      for (const part of furnitureParts(object)) {
        const key = `${geometryKey(part)}:${materialKey(part)}`
        const batch = groups.get(key) || { part, instances: [] }
        batch.instances.push({ id: object.id, matrix: partTransform(object,part) }); groups.set(key, batch)
      }
    }
    return [...groups.entries()]
  }, [level.furniture])
  if (!shown) return null
  const selected = level.furniture?.find(item => item.id === selection?.id)
  return <group name="Furniture">
    {batches.map(([key, batch]) => <Batch key={`${key}:${batch.instances.length}`} {...batch} select={select} />)}
    {selected && <mesh position={[selected.position.x, .02, selected.position.z]} rotation={[-Math.PI / 2, 0, -selected.rotation * Math.PI / 180]}>
      <planeGeometry args={[selected.width + .08, selected.depth + .08]} /><meshBasicMaterial color="#338ed0" transparent opacity={.45} depthWrite={false} />
    </mesh>}
  </group>
}
