import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { CatmullRomCurve3, InstancedMesh, Object3D, TubeGeometry, Vector3 } from 'three'
import type { ArchitecturalDetail, Selection } from '../domain/types'

const colors = { concrete: '#b3b4ad', steel: '#687477', timber: '#987857', glass: '#a2c0c3' }
function Repeats({
  count,
  spacing,
  width,
  height,
  depth,
  y,
  material,
  color,
}: {
  count: number
  spacing: number
  width: number
  height: number
  depth: number
  y: number
  material: ArchitecturalDetail['material']
  color: string
}) {
  const mesh = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    if (!mesh.current) return
    const item = new Object3D()
    for (let index = 0; index < count; index++) {
      item.position.set((index - (count - 1) / 2) * spacing, y, 0)
      item.scale.set(width, height, depth)
      item.updateMatrix()
      mesh.current.setMatrixAt(index, item.matrix)
    }
    mesh.current.instanceMatrix.needsUpdate = true
    mesh.current.computeBoundingSphere()
  }, [count, spacing, width, height, depth, y])
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} castShadow receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color={color}
        metalness={material === 'steel' ? 0.52 : 0.04}
        roughness={material === 'glass' ? 0.2 : 0.72}
      />
    </instancedMesh>
  )
}

export function ArchitecturalDetailMesh({
  detail,
  selection,
  select,
}: {
  detail: ArchitecturalDetail
  selection: Selection
  select: (selection: Selection) => void
}) {
  const dx = detail.end.x - detail.start.x,
    dz = detail.end.z - detail.start.z
  const length = Math.max(0.1, Math.hypot(dx, dz)),
    spacing = Math.max(0.25, detail.spacing)
  const count = Math.min(180, Math.max(2, Math.floor(length / spacing) + 1))
  const step = length / (count - 1),
    height = Math.max(0.12, detail.height),
    depth = Math.max(0.08, detail.depth)
  const color =
    selection?.kind === 'detail' && selection.id === detail.id
      ? '#c5a16c'
      : detail.color || colors[detail.material]
  const arch = useMemo(() => {
    if (detail.kind !== 'arch') return null
    const radius = Math.min(length / 2, height * 0.7),
      pier = Math.max(0.2, height - radius)
    const points = Array.from({ length: 17 }, (_, index) => {
      const angle = Math.PI - (index * Math.PI) / 16
      return new Vector3(radius * Math.cos(angle), pier + radius * Math.sin(angle), 0)
    })
    return {
      pier,
      radius,
      geometry: new TubeGeometry(new CatmullRomCurve3(points), 24, Math.min(0.22, depth / 2), 8, false),
    }
  }, [detail.kind, length, height, depth])
  useEffect(() => () => arch?.geometry.dispose(), [arch])
  return (
    <group
      position={[
        (detail.start.x + detail.end.x) / 2,
        detail.baseElevation,
        (detail.start.z + detail.end.z) / 2,
      ]}
      rotation={[0, -Math.atan2(dz, dx), 0]}
      onClick={(event) => {
        event.stopPropagation()
        select({ kind: 'detail', id: detail.id })
      }}
    >
      {detail.kind === 'railing' && (
        <>
          <Repeats
            count={count}
            spacing={step}
            width={0.065}
            height={height}
            depth={0.065}
            y={height / 2}
            material={detail.material}
            color={color}
          />
          {[height * 0.55, height].map((y) => (
            <mesh key={y} position={[0, y, 0]} castShadow>
              <boxGeometry args={[length, 0.065, 0.075]} />
              <meshStandardMaterial color={color} metalness={0.45} roughness={0.5} />
            </mesh>
          ))}
        </>
      )}
      {(detail.kind === 'screen' || detail.kind === 'fin') && (
        <Repeats
          count={count}
          spacing={step}
          width={detail.kind === 'fin' ? 0.18 : 0.09}
          height={height}
          depth={depth}
          y={height / 2}
          material={detail.material}
          color={color}
        />
      )}
      {detail.kind === 'parapet' && (
        <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[length, height, depth]} />
          <meshStandardMaterial color={color} roughness={0.86} />
        </mesh>
      )}
      {detail.kind === 'canopy' && (
        <mesh position={[0, height, depth / 2]} castShadow receiveShadow>
          <boxGeometry args={[length, 0.2, depth]} />
          <meshStandardMaterial color={color} metalness={0.16} roughness={0.55} />
        </mesh>
      )}
      {detail.kind === 'pergola' && (
        <>
          <Repeats
            count={count}
            spacing={step}
            width={0.12}
            height={0.15}
            depth={depth}
            y={height}
            material={detail.material}
            color={color}
          />
          {[-1, 1].map((side) => (
            <mesh key={side} position={[0, height - 0.12, (side * depth) / 2]} castShadow>
              <boxGeometry args={[length, 0.22, 0.14]} />
              <meshStandardMaterial color={color} roughness={0.65} />
            </mesh>
          ))}
        </>
      )}
      {arch && (
        <>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * arch.radius, arch.pier / 2, 0]} castShadow>
              <boxGeometry args={[depth, arch.pier, depth]} />
              <meshStandardMaterial color={color} roughness={0.78} />
            </mesh>
          ))}
          <mesh geometry={arch.geometry} castShadow>
            <meshStandardMaterial color={color} roughness={0.78} />
          </mesh>
        </>
      )}
    </group>
  )
}
