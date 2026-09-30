import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import type { Door, Selection, Wall } from '../domain/types'
import { atWall } from '../geometry/math'

function Leaf({ door, width, hinge, pivot, selected, open }: {
  door: Door; width: number; hinge: 'left' | 'right'; pivot: number; selected: boolean; open: boolean
}) {
  const ref = useRef<Group>(null)
  const sign = (hinge === 'left' ? 1 : -1) * (door.swing === 'out' ? -1 : 1)
  useFrame((_, delta) => {
    if (!ref.current) return
    const target = open ? sign * Math.PI * .48 : 0
    ref.current.rotation.y += (target - ref.current.rotation.y) * Math.min(1, delta * 9)
  })
  const center = hinge === 'left' ? width / 2 : -width / 2
  const metal = door.material === 'metal'
  return <group ref={ref} position={[pivot, 0, 0]}>
    <mesh position={[center, door.height / 2, 0]} castShadow receiveShadow>
      <boxGeometry args={[width, door.height - .09, .055]} />
      <meshStandardMaterial color={selected ? '#c58a39' : metal ? '#6f7777' : door.style === 'glazed' ? '#645a4e' : '#80694f'}
        metalness={metal ? .55 : .05} roughness={metal ? .42 : .58} />
    </mesh>
    {door.style === 'panel' && <mesh position={[center, door.height * .53, .035]}>
      <boxGeometry args={[width * .76, door.height * .72, .012]} />
      <meshStandardMaterial color={selected ? '#e2b979' : '#aa8d69'} roughness={.62} />
    </mesh>}
    {door.style === 'glazed' && <mesh position={[center, door.height * .62, .037]}>
      <boxGeometry args={[width * .75, door.height * .55, .014]} />
      <meshPhysicalMaterial color="#a8c3c9" metalness={.12} roughness={.14} transparent opacity={.75} />
    </mesh>}
    <mesh position={[center + (hinge === 'left' ? width * .38 : -width * .38), door.height * .49, .06]}>
      <sphereGeometry args={[.035, 8, 8]} />
      <meshStandardMaterial color="#d7c7a3" metalness={.7} roughness={.28} />
    </mesh>
  </group>
}

export function DoorMesh({ door, wall, selection, select, open }: {
  door: Door; wall: Wall; selection: Selection; select: (selection: Selection) => void; open: boolean
}) {
  const center = atWall(wall, door.offset + door.width / 2)
  const angle = -Math.atan2(wall.end.z - wall.start.z, wall.end.x - wall.start.x)
  const selected = selection?.kind === 'door' && selection.id === door.id
  const leaves = door.style === 'double'
    ? [{ width: (door.width - .12) / 2, hinge: 'left' as const, pivot: -door.width / 2 + .05 },
      { width: (door.width - .12) / 2, hinge: 'right' as const, pivot: door.width / 2 - .05 }]
    : [{ width: door.width - .1, hinge: door.hinge, pivot: door.hinge === 'left' ? -door.width / 2 + .05 : door.width / 2 - .05 }]
  const hover = (active: boolean) => {
    const canvas = document.querySelector<HTMLCanvasElement>('.viewer canvas')
    if (canvas) canvas.style.cursor = active ? 'pointer' : ''
  }
  return <group position={[center.x, 0, center.z]} rotation={[0, angle, 0]}
    onClick={event => { event.stopPropagation(); select({ kind: 'door', id: door.id }) }}
    onPointerOver={event => { event.stopPropagation(); hover(true) }} onPointerOut={() => hover(false)}>
    {[-1, 1].map(side => <mesh key={side} position={[side * door.width / 2, door.height / 2, 0]} castShadow>
      <boxGeometry args={[.075, door.height, wall.thickness + .08]} />
      <meshStandardMaterial color={selected ? '#e0a545' : '#625a4b'} roughness={.75} />
    </mesh>)}
    <mesh position={[0, door.height, 0]} castShadow>
      <boxGeometry args={[door.width + .07, .075, wall.thickness + .08]} />
      <meshStandardMaterial color={selected ? '#e0a545' : '#625a4b'} />
    </mesh>
    {leaves.map((leaf, index) => <Leaf key={index} door={door} {...leaf} selected={selected} open={open} />)}
    <mesh position={[0, .035, 0]} castShadow receiveShadow>
      <boxGeometry args={[door.width, .07, wall.thickness + .06]} />
      <meshStandardMaterial color="#777770" metalness={.12} roughness={.72} />
    </mesh>
    {selected && !open && <mesh position={[0, door.height / 2, -.05]}>
      <boxGeometry args={[door.width + .14, door.height + .14, .012]} />
      <meshBasicMaterial color="#e9b459" transparent opacity={.45} />
    </mesh>}
  </group>
}
