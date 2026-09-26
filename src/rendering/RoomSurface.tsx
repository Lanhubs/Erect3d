import { useMemo } from 'react'
import { DoubleSide, Shape } from 'three'
import type { Room, Selection } from '../domain/types'
import { materialRoughness } from './materials'
import { floorTexture } from './textures'

export function RoomSurface({ room, ceiling, select }: { room: Room; ceiling?: boolean; select?: (selection: Selection) => void }) {
  const shape = useMemo(() => {
    const next = new Shape()
    room.polygon.forEach((point, index) => index ? next.lineTo(point.x, point.z) : next.moveTo(point.x, point.z))
    next.closePath()
    return next
  }, [room.polygon])
  const position: [number, number, number] = [0, ceiling ? (room.ceilingHeight || 2.9) : .006, 0]
  return <mesh rotation={[Math.PI / 2, 0, 0]} position={position} receiveShadow
    onPointerOver={event => { if (ceiling) return; event.stopPropagation(); const canvas = document.querySelector<HTMLCanvasElement>('.viewer canvas'); if (canvas) canvas.style.cursor = 'pointer' }}
    onPointerOut={() => { if (!ceiling) { const canvas = document.querySelector<HTMLCanvasElement>('.viewer canvas'); if (canvas) canvas.style.cursor = '' } }}
    onClick={event => { if (!ceiling && select) { event.stopPropagation(); select({ kind: 'room', id: room.id }) } }}>
    <shapeGeometry args={[shape]} />
    {ceiling ? <meshStandardMaterial color="#e8e5dd" roughness={.96} side={DoubleSide} />
      : <meshStandardMaterial color="#ffffff" map={floorTexture(room.material)} roughness={materialRoughness[room.material]} side={DoubleSide} />}
  </mesh>
}
