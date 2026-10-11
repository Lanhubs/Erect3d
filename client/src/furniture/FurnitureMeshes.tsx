import { useLayoutEffect, useMemo, useRef } from 'react'
import { BoxGeometry, CylinderGeometry, SphereGeometry, Matrix4, Quaternion, Vector3, type InstancedMesh } from 'three'
import type { Level, Selection } from '../domain/types'
import { furnitureParts, type FurniturePart } from './assets'
import { useFurnitureReview } from './reviewState'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
const geometries = { box: new BoxGeometry(1, 1, 1), 'soft-box': new RoundedBoxGeometry(1, 1, 1, 2, .04), cylinder: new CylinderGeometry(.5, .5, 1, 12), sphere: new SphereGeometry(.5, 12, 8) }
type Instance = { id: string; matrix: Matrix4 }
function Batch({ part, instances, select }: { part: FurniturePart; instances: Instance[]; select: (selection: Selection) => void }) {
  const mesh = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    instances.forEach((instance, i) => mesh.current!.setMatrixAt(i, instance.matrix))
    mesh.current!.instanceMatrix.needsUpdate = true; mesh.current!.computeBoundingSphere()
  }, [instances])
  return <instancedMesh ref={mesh} args={[geometries[part.shape], undefined, instances.length]} castShadow receiveShadow frustumCulled
    onClick={event => { event.stopPropagation(); if (event.instanceId !== undefined) select({ kind: 'furniture', id: instances[event.instanceId].id }) }}>
    <meshStandardMaterial color={part.color} roughness={part.roughness} metalness={part.metalness} transparent={(part.opacity ?? 1) < 1} opacity={part.opacity ?? 1} />
  </instancedMesh>
}
export function FurnitureMeshes({ level, selection, select }: { level: Level; selection: Selection; select: (selection: Selection) => void }) {
  const shown = useFurnitureReview(state => state.shown)
  const batches = useMemo(() => {
    const groups = new Map<string, { part: FurniturePart; instances: Instance[] }>()
    for (const object of level.furniture || []) {
      const rotation = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -object.rotation * Math.PI / 180)
      for (const part of furnitureParts(object)) {
        const key = `${part.shape}:${part.color}:${part.roughness}:${part.metalness}:${part.opacity || 1}`
        const batch = groups.get(key) || { part, instances: [] }
        const position = new Vector3(...part.at).applyQuaternion(rotation).add(new Vector3(object.position.x, 0, object.position.z))
        batch.instances.push({ id: object.id, matrix: new Matrix4().compose(position, rotation, new Vector3(...part.size)) }); groups.set(key, batch)
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
