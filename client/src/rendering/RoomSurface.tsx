import { useMemo } from 'react'
import { DoubleSide } from 'three'
import type { Point, Room, Selection } from '../domain/types'
import { roomShapes } from './roomShape'
import { materialRoughness } from './materials'
import { floorTexture } from './textures'
import {BasketballCourt} from './BasketballCourt'

const p = (x: number, z: number): Point => ({ x, z })

function Marking({ start, end, thickness, color = '#f5f2e7' }: { start: Point; end: Point; thickness: number; color?: string }) {
  const dx = end.x - start.x, dz = end.z - start.z, length = Math.hypot(dx, dz)
  if (length < .01) return null
  return <mesh position={[(start.x + end.x) / 2, .065, (start.z + end.z) / 2]} rotation={[0, -Math.atan2(dz, dx), 0]}>
    <boxGeometry args={[length, .025, thickness]} /><meshBasicMaterial color={color} />
  </mesh>
}

function SportsFloorDetails({ room }: { room: Room }) {
  if(room.category==='basketball-court')return <BasketballCourt room={room}/>
  const points = room.polygon
  if (!points.length) return null
  const xs = points.map(point => point.x), zs = points.map(point => point.z)
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs)
  const width = maxX - minX, depth = maxZ - minZ, centerX = (minX + maxX) / 2, centerZ = (minZ + maxZ) / 2
  const marking = '#f5f2e7'
  if (room.category === 'football-pitch') return <group>
    <Marking start={p(minX, minZ)} end={p(maxX, minZ)} thickness={.11} />
    <Marking start={p(maxX, minZ)} end={p(maxX, maxZ)} thickness={.11} />
    <Marking start={p(maxX, maxZ)} end={p(minX, maxZ)} thickness={.11} />
    <Marking start={p(minX, maxZ)} end={p(minX, minZ)} thickness={.11} />
    <Marking start={p(centerX, minZ)} end={p(centerX, maxZ)} thickness={.1} />
    <mesh position={[centerX, .067, centerZ]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[9.08, 9.2, 48]} /><meshBasicMaterial color={marking} side={DoubleSide} />
    </mesh>
    <mesh position={[centerX, .07, centerZ]}><cylinderGeometry args={[.14, .14, .025, 16]} />
      <meshBasicMaterial color={marking} /></mesh>
    {[minX + width * .16, maxX - width * .16].map((x, index) => {
      const innerX = x + (index ? -2.5 : 2.5), goalX = index ? maxX + 2.5 : minX - 2.5
      const boxMinX = index ? x : minX, boxMaxX = index ? maxX : x
      return <group key={index}>
        <Marking start={p(boxMinX, centerZ - depth * .24)} end={p(boxMaxX, centerZ - depth * .24)} thickness={.09} />
        <Marking start={p(boxMaxX, centerZ - depth * .24)} end={p(boxMaxX, centerZ + depth * .24)} thickness={.09} />
        <Marking start={p(boxMaxX, centerZ + depth * .24)} end={p(boxMinX, centerZ + depth * .24)} thickness={.09} />
        <Marking start={p(x, centerZ - 3.66)} end={p(x, centerZ + 3.66)} thickness={.1} />
        {[-3.66, 3.66].map(z => <mesh key={z} position={[goalX, .4, centerZ + z]}>
          <boxGeometry args={[.12, .8, .12]} /><meshStandardMaterial color="#d7ded0" metalness={.42} roughness={.45} />
        </mesh>)}
        <mesh position={[goalX, .8, centerZ]}><boxGeometry args={[.12, .12, 7.32]} />
          <meshStandardMaterial color="#d7ded0" metalness={.42} roughness={.45} /></mesh>
        <mesh position={[innerX, .07, centerZ]}><cylinderGeometry args={[.12, .12, .025, 12]} />
          <meshBasicMaterial color={marking} /></mesh>
      </group>
    })}
  </group>
  if (room.category === 'table-tennis-hall') return <group>
    {[centerX - width * .24, centerX, centerX + width * .24].map((x, index) => <group key={index}>
      <Marking start={p(x - 2.9, centerZ - 1.7)} end={p(x + 2.9, centerZ - 1.7)} thickness={.06} />
      <Marking start={p(x + 2.9, centerZ - 1.7)} end={p(x + 2.9, centerZ + 1.7)} thickness={.06} />
      <Marking start={p(x + 2.9, centerZ + 1.7)} end={p(x - 2.9, centerZ + 1.7)} thickness={.06} />
      <Marking start={p(x - 2.9, centerZ + 1.7)} end={p(x - 2.9, centerZ - 1.7)} thickness={.06} />
      <mesh position={[x, .79, centerZ]} castShadow><boxGeometry args={[2.74, .08, 1.525]} />
        <meshStandardMaterial color="#286c78" roughness={.62} /></mesh>
      <mesh position={[x, .84, centerZ]}><boxGeometry args={[2.74, .015, .035]} /><meshBasicMaterial color="#f8f5ec" /></mesh>
      <mesh position={[x, .91, centerZ]}><boxGeometry args={[.025, .14, 1.55]} /><meshStandardMaterial color="#ddd9cb" /></mesh>
    </group>)}
    <mesh position={[centerX, .065, minZ + .65]}><boxGeometry args={[width * .72, .025, .08]} /><meshBasicMaterial color="#f5f2e7" /></mesh>
  </group>
  return null
}

export function RoomSurface({ room, ceiling, select, openings = [] }: { room: Room; ceiling?: boolean;
  select?: (selection: Selection) => void; openings?: Point[][] }) {
  const shapes = useMemo(() => roomShapes(room, openings), [room, openings])
  const basketball=room.category==='basketball-court',specialFloor = room.category === 'football-pitch' || room.category === 'table-tennis-hall' || basketball
  const position: [number, number, number] = [0, ceiling ? (room.ceilingHeight || 2.9) : specialFloor ? .04 : .006, 0]
  return <group><mesh rotation={[Math.PI / 2, 0, 0]} position={position} receiveShadow
    onPointerOver={event => { if (ceiling) return; event.stopPropagation(); const canvas = document.querySelector<HTMLCanvasElement>('.viewer canvas'); if (canvas) canvas.style.cursor = 'pointer' }}
    onPointerOut={() => { if (!ceiling) { const canvas = document.querySelector<HTMLCanvasElement>('.viewer canvas'); if (canvas) canvas.style.cursor = '' } }}
    onClick={event => { if (!ceiling && select) { event.stopPropagation(); select({ kind: 'room', id: room.id }) } }}>
    <shapeGeometry args={[shapes]} />
    {ceiling ? <meshStandardMaterial color="#e8e5dd" roughness={.96} side={DoubleSide} />
      : <meshStandardMaterial color={basketball?'#e4c797':specialFloor ? room.category === 'football-pitch' ? '#4c8850' : '#72866a' : '#ffffff'}
        map={basketball?floorTexture('timber'):specialFloor ? undefined : floorTexture(room.material)} roughness={basketball ? .48 : specialFloor ? .94 : materialRoughness[room.material]}
        side={DoubleSide} />}
  </mesh>{!ceiling && specialFloor && <SportsFloorDetails room={room} />}</group>
}
