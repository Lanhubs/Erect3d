import { useLayoutEffect, useMemo, useRef } from 'react'
import { BoxGeometry, InstancedMesh, Matrix4, Object3D } from 'three'
import type { SeatingSection, Selection } from '../domain/types'

export function SeatingMesh({ section, selection, select }: { section: SeatingSection; selection: Selection; select: (selection: Selection) => void }) {
  const length = Math.hypot(section.end.x - section.start.x, section.end.z - section.start.z)
  const seatsPerRow = Math.max(1, Math.min(180, section.seatsPerRow))
  const rows = Math.max(1, Math.min(40, section.rows))
  const seatCount = seatsPerRow * rows
  const yaw = -Math.atan2(section.end.z - section.start.z, section.end.x - section.start.x)
  const tangent = { x: (section.end.x - section.start.x) / Math.max(length, .001), z: (section.end.z - section.start.z) / Math.max(length, .001) }
  const outwardLength = Math.hypot(section.outward.x, section.outward.z) || 1
  const outward = { x: section.outward.x / outwardLength, z: section.outward.z / outwardLength }
  const seatWidth = Math.min(.52, length / seatsPerRow * .88)
  const treadMesh = useRef<InstancedMesh>(null), seatMesh = useRef<InstancedMesh>(null), backMesh = useRef<InstancedMesh>(null)
  const geometry = useMemo(() => new BoxGeometry(1, 1, 1), [])
  const treadMatrices = useMemo(() => Array.from({ length: rows }, (_, index) => {
    const object = new Object3D(), along = length / 2
    object.position.set(section.start.x + tangent.x * along + outward.x * (index + .5) * section.rowDepth,
      section.baseElevation + index * section.rowRise, section.start.z + tangent.z * along + outward.z * (index + .5) * section.rowDepth)
    object.rotation.y = yaw
    object.scale.set(length, Math.max(.08, section.rowRise * .62), section.rowDepth * .9)
    object.updateMatrix()
    return object.matrix.clone()
  }), [rows, length, section.start.x, section.start.z, section.baseElevation, section.rowRise, section.rowDepth, tangent.x, tangent.z, outward.x, outward.z, yaw])
  const seatMatrices = useMemo(() => {
    const seats: Matrix4[] = [], backs: Matrix4[] = [], object = new Object3D()
    for (let row = 0; row < rows; row++) for (let seat = 0; seat < seatsPerRow; seat++) {
      const along = length * (seat + .5) / seatsPerRow
      const x = section.start.x + tangent.x * along + outward.x * (row + .5) * section.rowDepth
      const z = section.start.z + tangent.z * along + outward.z * (row + .5) * section.rowDepth
      const y = section.baseElevation + row * section.rowRise + .16
      object.rotation.y = yaw
      object.position.set(x, y, z); object.scale.set(seatWidth, .08, section.rowDepth * .45)
      object.updateMatrix(); seats.push(object.matrix.clone())
      object.position.set(x + outward.x * section.rowDepth * .23, y + .21, z + outward.z * section.rowDepth * .23)
      object.scale.set(seatWidth, .38, .055); object.updateMatrix(); backs.push(object.matrix.clone())
    }
    return { seats, backs }
  }, [rows, seatsPerRow, length, section.start.x, section.start.z, section.baseElevation, section.rowRise,
    section.rowDepth, tangent.x, tangent.z, outward.x, outward.z, yaw, seatWidth])
  useLayoutEffect(() => {
    const write = (mesh: InstancedMesh | null, matrices: Matrix4[]) => {
      if (!mesh) return
      matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix))
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
    }
    write(treadMesh.current, treadMatrices); write(seatMesh.current, seatMatrices.seats); write(backMesh.current, seatMatrices.backs)
  }, [treadMatrices, seatMatrices])
  const selected = selection?.kind === 'seating' && selection.id === section.id
  return <group onClick={event => { event.stopPropagation(); select({ kind: 'seating', id: section.id }) }}>
    <instancedMesh ref={treadMesh} args={[geometry, undefined, rows]} castShadow receiveShadow>
      <meshStandardMaterial color={selected ? '#c3a36e' : '#9b9b94'} roughness={.88} />
    </instancedMesh>
    <instancedMesh ref={seatMesh} args={[geometry, undefined, seatCount]} castShadow receiveShadow>
      <meshStandardMaterial color={section.seatColor} roughness={.54} />
    </instancedMesh>
    <instancedMesh ref={backMesh} args={[geometry, undefined, seatCount]} castShadow receiveShadow>
      <meshStandardMaterial color={section.seatColor} roughness={.5} />
    </instancedMesh>
  </group>
}