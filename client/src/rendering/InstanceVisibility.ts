import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, type RefObject } from 'react'
import { Frustum, Matrix4, Sphere, Vector3, type InstancedMesh } from 'three'
export function useInstanceVisibility(mesh: RefObject<InstancedMesh | null>) {
  const buffers = useMemo(
    () => ({ frustum: new Frustum(), matrix: new Matrix4(), sphere: new Sphere(), camera: new Vector3() }),
    [],
  )
  const previous = useRef({
    matrix: [] as number[],
    world: [] as number[],
    bounds: 0,
    mesh: null as InstancedMesh | null,
  })
  useFrame(({ camera }) => {
    const target = mesh.current
    if (!target || !target.boundingSphere) return
    buffers.matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    target.updateWorldMatrix(true, false)
    if (
      previous.current.mesh === target &&
      previous.current.bounds === target.userData.boundsVersion &&
      buffers.matrix.elements.every((value, index) => value === previous.current.matrix[index]) &&
      target.matrixWorld.elements.every((value, index) => value === previous.current.world[index])
    )
      return
    previous.current = {
      mesh: target,
      matrix: [...buffers.matrix.elements],
      world: [...target.matrixWorld.elements],
      bounds: target.userData.boundsVersion,
    }
    buffers.frustum.setFromProjectionMatrix(buffers.matrix, camera.coordinateSystem)
    buffers.sphere.copy(target.boundingSphere).applyMatrix4(target.matrixWorld)
    camera.getWorldPosition(buffers.camera)
    // Whole architectural batches are culled, never individual semantic data.
    target.visible =
      (target.castShadow || buffers.frustum.intersectsSphere(buffers.sphere)) &&
      buffers.camera.distanceTo(buffers.sphere.center) - buffers.sphere.radius < camera.far
  })
}
