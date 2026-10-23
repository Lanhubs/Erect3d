import { useEffect, useMemo } from 'react'
import { BufferGeometry, DoubleSide, Float32BufferAttribute } from 'three'
import type { Roof } from '../domain/types'
import type { Vertex } from '../geometry/roof'
import { roofTexture } from './roofTextures'
import { roofSurfaceGeometry, roofSoffitGeometry } from '../geometry/roofSurfaceGeometry'
export function Surface({
  vertices,
  roof,
  gable = false,
}: {
  vertices: Vertex[]
  roof: Roof
  gable?: boolean
}) {
  const geometry = useMemo(() => roofSurfaceGeometry([vertices], !gable), [vertices, gable])
  const soffit = useMemo(() => roofSoffitGeometry(geometry, 0.09), [geometry])
  const sides = useMemo(() => {
    const positions: number[] = []
    for (let index = 0; index < vertices.length; index++) {
      const a = vertices[index],
        b = vertices[(index + 1) % vertices.length]
      const belowA: Vertex = [a[0], a[1] - 0.09, a[2]],
        belowB: Vertex = [b[0], b[1] - 0.09, b[2]]
      positions.push(...a, ...b, ...belowB, ...a, ...belowB, ...belowA)
    }
    const shape = new BufferGeometry()
    shape.setAttribute('position', new Float32BufferAttribute(positions, 3))
    shape.computeVertexNormals()
    return shape
  }, [vertices])
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => soffit.dispose(), [soffit])
  useEffect(() => () => sides.dispose(), [sides])
  return (
    <group>
      <mesh geometry={geometry} castShadow receiveShadow>
        {gable ? (
          <meshStandardMaterial color="#d5d2c8" roughness={0.92} side={DoubleSide} />
        ) : roof.material === 'glass' ? (
          <meshPhysicalMaterial
            color={roof.color}
            metalness={0.08}
            roughness={0.12}
            transmission={0.4}
            transparent
            opacity={0.68}
            side={DoubleSide}
            depthWrite={false}
          />
        ) : (
          <meshStandardMaterial
            map={roofTexture(roof.material)}
            color={roof.color}
            metalness={
              ['standing-seam', 'long-span-metal', 'corrugated', 'stone-coated-metal'].includes(roof.material)
                ? 0.28
                : 0.03
            }
            roughness={
              roof.material === 'membrane'
                ? 0.78
                : roof.material === 'standing-seam'
                  ? 0.4
                  : roof.material === 'corrugated' || roof.material === 'long-span-metal'
                    ? 0.56
                    : 0.84
            }
            shadowSide={DoubleSide}
          />
        )}
      </mesh>
      {!gable && roof.material !== 'glass' && (
        <mesh geometry={soffit} receiveShadow>
          <meshStandardMaterial color="#d2d1c9" roughness={0.9} />
        </mesh>
      )}
      {!gable && (
        <mesh geometry={sides} castShadow receiveShadow>
          <meshStandardMaterial color={roof.color} metalness={0.18} roughness={0.65} side={DoubleSide} />
        </mesh>
      )}
    </group>
  )
}
