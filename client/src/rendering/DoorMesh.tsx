import {SharedStandardMaterial} from './SharedStandardMaterial'
import { useRef,useMemo } from 'react'
import { useFrame,useThree } from '@react-three/fiber'
import type { Group } from 'three'
import type { Door, Selection, Wall } from '../domain/types'
import { atWall, wallTangentAngle } from '../geometry/math'
import {doorLeafAssembly} from '../geometry/doorLeafAssembly'
import {EntityInstances} from './EntityInstances'
import {SectionalDoor} from './SectionalDoor'
import {useRenderResources} from './RenderResources'

function Leaf({ door, width, hinge, pivot, selected, open }: {
  door: Door; width: number; hinge: 'left' | 'right'; pivot: number; selected: boolean; open: boolean
}) {
  const ref = useRef<Group>(null)
  const invalidate=useThree(state=>state.invalidate)
  const resources=useRenderResources()
  const sign = (hinge === 'left' ? 1 : -1) * (door.swing === 'out' ? -1 : 1)
  useFrame((_, delta) => {
    if (!ref.current) return
    const target = open ? sign * Math.PI * .48 : 0
    if(Math.abs(target-ref.current.rotation.y)>.00001)resources.shadowEpoch++
    ref.current.rotation.y += (target - ref.current.rotation.y) * Math.min(1, delta * 9)
    if(Math.abs(target-ref.current.rotation.y)>.001)invalidate()
  },-1)
  const center = hinge === 'left' ? width / 2 : -width / 2
  const metal = door.material === 'metal'
  const style=door.style==='sectional'?'panel':door.style==='double'?door.leafStyle||'panel':door.style||'flush'
  const assembly=useMemo(()=>doorLeafAssembly(style,width,door.height-.09),[style,width,door.height])
  return <group ref={ref} position={[pivot, 0, 0]}>
    <group position={[center,.015,0]}>
      <EntityInstances parts={assembly.body} color={selected?'#c58a39':metal?'#6f7777':'#80694f'} material={metal?'metal':'timber'}/>
      {!!assembly.glass.length&&<EntityInstances parts={assembly.glass} color="#c6dde1" material="window-glass" shadow={false}/>}
      {!!assembly.panel.length&&<EntityInstances parts={assembly.panel} color={selected?'#e2b979':'#94785c'} material={metal?'metal':'timber'}/>}
    </group>
    <mesh position={[center + (hinge === 'left' ? width * .38 : -width * .38), door.height * .49, .06]}>
      <sphereGeometry args={[.035, 8, 8]} />
      <SharedStandardMaterial color="#d7c7a3" metalness={.7} roughness={.28} />
    </mesh>
  </group>
}

export function DoorMesh({ door, wall, selection, select, open }: {
  door: Door; wall: Wall; selection: Selection; select: (selection: Selection) => void; open: boolean
}) {
  const start=atWall(wall,door.offset),end=atWall(wall,door.offset+door.width),width=wall.curve?Math.hypot(end.x-start.x,end.z-start.z):door.width
  const center = wall.curve?{x:(start.x+end.x)/2,z:(start.z+end.z)/2}:atWall(wall, door.offset + door.width / 2)
  const angle = -wallTangentAngle(wall, door.offset + door.width / 2)
  const selected = selection?.kind === 'door' && selection.id === door.id
  const leaves = door.style === 'double'
    ? [{ width: (width - .144) / 2, hinge: 'left' as const, pivot: -width / 2 + .068 },
      { width: (width - .144) / 2, hinge: 'right' as const, pivot: width / 2 - .068 }]
    : [{ width: width - .136, hinge: door.hinge, pivot: door.hinge === 'left' ? -width / 2 + .068 : width / 2 - .068 }]
  const hover = (active: boolean) => {
    const canvas = document.querySelector<HTMLCanvasElement>('.viewer canvas')
    if (canvas) canvas.style.cursor = active ? 'pointer' : ''
  }
  return <group position={[center.x, 0, center.z]} rotation={[0, angle, 0]}
    onClick={event => { event.stopPropagation(); select({ kind: 'door', id: door.id }) }}
    onPointerOver={event => { event.stopPropagation(); hover(true) }} onPointerOut={() => hover(false)}>
    {[-1, 1].map(side => <mesh key={side} position={[side * (width-.06) / 2, door.height / 2, 0]} castShadow>
      <boxGeometry args={[.06, door.height, wall.thickness + .02]} />
      <SharedStandardMaterial color={selected ? '#e0a545' : '#625a4b'} roughness={.75} />
    </mesh>)}
    <mesh position={[0, door.height-.03, 0]} castShadow>
      <boxGeometry args={[width-.12, .06, wall.thickness + .02]} />
      <SharedStandardMaterial color={selected ? '#e0a545' : '#625a4b'} />
    </mesh>
    {door.style==='sectional'?<SectionalDoor width={width} height={door.height} selected={selected} open={open} metal={door.material!=='timber'}/>:leaves.map((leaf, index) => <Leaf key={index} door={door} {...leaf} selected={selected} open={open} />)}
    <mesh position={[0, .01, 0]} castShadow receiveShadow>
      <boxGeometry args={[width, .02, wall.thickness + .02]} />
      <SharedStandardMaterial color="#777770" metalness={.12} roughness={.72} />
    </mesh>
    {selected && !open && <mesh position={[0, door.height / 2, -.05]}>
      <boxGeometry args={[width + .03, door.height + .03, wall.thickness+.025]} />
      <meshBasicMaterial color="#e9b459" wireframe />
    </mesh>}
  </group>
}
