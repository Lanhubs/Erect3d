import { useEffect, useMemo } from 'react'
import { ExtrudeGeometry } from 'three'
import type { Point, Room } from '../domain/types'
import { roomShapes } from './roomShape'
import { SharedStandardMaterial } from './SharedStandardMaterial'

export function CeilingSurface({
  room,
  openings,
  height,
}: {
  room: Room
  openings: Point[][]
  height: number
}) {
  const geometry = useMemo(() => {
    const result = new ExtrudeGeometry(roomShapes(room, openings), {
      depth: 0.08,
      bevelEnabled: false,
      steps: 1,
    })
    result.rotateX(Math.PI / 2)
    result.translate(0, height + 0.08, 0)
    return result
  }, [room.polygon, openings, height])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <mesh geometry={geometry} receiveShadow castShadow>
      <SharedStandardMaterial color="#ece9e2" roughness={0.94} />
    </mesh>
  )
}
