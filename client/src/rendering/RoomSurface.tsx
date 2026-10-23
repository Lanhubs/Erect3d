import { SharedStandardMaterial } from './SharedStandardMaterial'
import { useMemo } from 'react'
import { DoubleSide } from 'three'
import type { Point, Room, Selection } from '../domain/types'
import { roomShapes } from './roomShape'
import { materialRoughness } from './materials'
import { floorTexture } from './textures'
import { BasketballCourt } from './BasketballCourt'

const p = (x: number, z: number): Point => ({ x, z })

function Marking({
  start,
  end,
  thickness,
  color = '#f5f2e7',
}: {
  start: Point
  end: Point
  thickness: number
  color?: string
}) {
  const dx = end.x - start.x,
    dz = end.z - start.z,
    length = Math.hypot(dx, dz)
  if (length < 0.01) return null
  return (
    <mesh
      position={[(start.x + end.x) / 2, 0.065, (start.z + end.z) / 2]}
      rotation={[0, -Math.atan2(dz, dx), 0]}
    >
      <boxGeometry args={[length, 0.025, thickness]} />
      <meshBasicMaterial color={color} />
    </mesh>
  )
}

function SportsFloorDetails({ room }: { room: Room }) {
  if (room.category === 'basketball-court') return <BasketballCourt room={room} />
  const points = room.polygon
  if (!points.length) return null
  const xs = points.map((point) => point.x),
    zs = points.map((point) => point.z)
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minZ = Math.min(...zs),
    maxZ = Math.max(...zs)
  const width = maxX - minX,
    depth = maxZ - minZ,
    centerX = (minX + maxX) / 2,
    centerZ = (minZ + maxZ) / 2
  const marking = '#f5f2e7'
  if (room.category === 'football-pitch')
    return (
      <group>
        <Marking start={p(minX, minZ)} end={p(maxX, minZ)} thickness={0.11} />
        <Marking start={p(maxX, minZ)} end={p(maxX, maxZ)} thickness={0.11} />
        <Marking start={p(maxX, maxZ)} end={p(minX, maxZ)} thickness={0.11} />
        <Marking start={p(minX, maxZ)} end={p(minX, minZ)} thickness={0.11} />
        <Marking start={p(centerX, minZ)} end={p(centerX, maxZ)} thickness={0.1} />
        <mesh position={[centerX, 0.067, centerZ]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[9.08, 9.2, 48]} />
          <meshBasicMaterial color={marking} side={DoubleSide} />
        </mesh>
        <mesh position={[centerX, 0.07, centerZ]}>
          <cylinderGeometry args={[0.14, 0.14, 0.025, 16]} />
          <meshBasicMaterial color={marking} />
        </mesh>
        {[minX + width * 0.16, maxX - width * 0.16].map((x, index) => {
          const innerX = x + (index ? -2.5 : 2.5),
            goalX = index ? maxX + 2.5 : minX - 2.5
          const boxMinX = index ? x : minX,
            boxMaxX = index ? maxX : x
          return (
            <group key={index}>
              <Marking
                start={p(boxMinX, centerZ - depth * 0.24)}
                end={p(boxMaxX, centerZ - depth * 0.24)}
                thickness={0.09}
              />
              <Marking
                start={p(boxMaxX, centerZ - depth * 0.24)}
                end={p(boxMaxX, centerZ + depth * 0.24)}
                thickness={0.09}
              />
              <Marking
                start={p(boxMaxX, centerZ + depth * 0.24)}
                end={p(boxMinX, centerZ + depth * 0.24)}
                thickness={0.09}
              />
              <Marking start={p(x, centerZ - 3.66)} end={p(x, centerZ + 3.66)} thickness={0.1} />
              {[-3.66, 3.66].map((z) => (
                <mesh key={z} position={[goalX, 0.4, centerZ + z]}>
                  <boxGeometry args={[0.12, 0.8, 0.12]} />
                  <SharedStandardMaterial color="#d7ded0" metalness={0.42} roughness={0.45} />
                </mesh>
              ))}
              <mesh position={[goalX, 0.8, centerZ]}>
                <boxGeometry args={[0.12, 0.12, 7.32]} />
                <SharedStandardMaterial color="#d7ded0" metalness={0.42} roughness={0.45} />
              </mesh>
              <mesh position={[innerX, 0.07, centerZ]}>
                <cylinderGeometry args={[0.12, 0.12, 0.025, 12]} />
                <meshBasicMaterial color={marking} />
              </mesh>
            </group>
          )
        })}
      </group>
    )
  if (room.category === 'table-tennis-hall')
    return (
      <group>
        {[centerX - width * 0.24, centerX, centerX + width * 0.24].map((x, index) => (
          <group key={index}>
            <Marking start={p(x - 2.9, centerZ - 1.7)} end={p(x + 2.9, centerZ - 1.7)} thickness={0.06} />
            <Marking start={p(x + 2.9, centerZ - 1.7)} end={p(x + 2.9, centerZ + 1.7)} thickness={0.06} />
            <Marking start={p(x + 2.9, centerZ + 1.7)} end={p(x - 2.9, centerZ + 1.7)} thickness={0.06} />
            <Marking start={p(x - 2.9, centerZ + 1.7)} end={p(x - 2.9, centerZ - 1.7)} thickness={0.06} />
            <mesh position={[x, 0.79, centerZ]} castShadow>
              <boxGeometry args={[2.74, 0.08, 1.525]} />
              <SharedStandardMaterial color="#286c78" roughness={0.62} />
            </mesh>
            <mesh position={[x, 0.84, centerZ]}>
              <boxGeometry args={[2.74, 0.015, 0.035]} />
              <meshBasicMaterial color="#f8f5ec" />
            </mesh>
            <mesh position={[x, 0.91, centerZ]}>
              <boxGeometry args={[0.025, 0.14, 1.55]} />
              <SharedStandardMaterial color="#ddd9cb" />
            </mesh>
          </group>
        ))}
        <mesh position={[centerX, 0.065, minZ + 0.65]}>
          <boxGeometry args={[width * 0.72, 0.025, 0.08]} />
          <meshBasicMaterial color="#f5f2e7" />
        </mesh>
      </group>
    )
  return null
}

export function RoomSurface({
  room,
  ceiling,
  select,
  openings = [],
}: {
  room: Room
  ceiling?: boolean
  select?: (selection: Selection) => void
  openings?: Point[][]
}) {
  const shapes = useMemo(() => roomShapes(room, openings), [room, openings])
  const basketball = room.category === 'basketball-court',
    specialFloor = room.category === 'football-pitch' || room.category === 'table-tennis-hall' || basketball
  const position: [number, number, number] = [
    0,
    ceiling ? room.ceilingHeight || 2.9 : specialFloor ? 0.04 : 0.006,
    0,
  ]
  return (
    <group>
      <mesh
        rotation={[Math.PI / 2, 0, 0]}
        position={position}
        receiveShadow
        onPointerOver={(event) => {
          if (ceiling) return
          event.stopPropagation()
          const canvas = document.querySelector<HTMLCanvasElement>('.viewer canvas')
          if (canvas) canvas.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          if (!ceiling) {
            const canvas = document.querySelector<HTMLCanvasElement>('.viewer canvas')
            if (canvas) canvas.style.cursor = ''
          }
        }}
        onClick={(event) => {
          if (!ceiling && select) {
            event.stopPropagation()
            select({ kind: 'room', id: room.id })
          }
        }}
      >
        <shapeGeometry args={[shapes]} />
        {ceiling ? (
          <SharedStandardMaterial color="#e8e5dd" roughness={0.96} side={DoubleSide} />
        ) : (
          <SharedStandardMaterial
            color={
              basketball
                ? '#e4c797'
                : specialFloor
                  ? room.category === 'football-pitch'
                    ? '#4c8850'
                    : '#72866a'
                  : '#ffffff'
            }
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-4}
            map={basketball ? floorTexture('timber') : specialFloor ? undefined : floorTexture(room.material)}
            roughness={basketball ? 0.48 : specialFloor ? 0.94 : materialRoughness[room.material]}
            side={DoubleSide}
          />
        )}
      </mesh>
      {!ceiling && specialFloor && <SportsFloorDetails room={room} />}
    </group>
  )
}
