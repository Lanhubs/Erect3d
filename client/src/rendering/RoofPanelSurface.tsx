import {useEffect,useMemo} from 'react'
import {BufferGeometry,DoubleSide,Float32BufferAttribute} from 'three'
import type {Roof} from '../domain/types'
import type {Vertex} from '../geometry/roof'
import {roofTexture} from './roofTextures'
export function Surface({ vertices, roof, gable = false }: { vertices: Vertex[]; roof: Roof; gable?: boolean }) {
  const rotateTexture = useMemo(() => {
    const edges = vertices.map((point, index) => {
      const next = vertices[(index + 1) % vertices.length]
      return { dx: next[0] - point[0], dz: next[2] - point[2], dy: Math.abs(next[1] - point[1]) }
    }).filter(edge => edge.dy < .02)
    const longest = edges.sort((a, b) => Math.hypot(b.dx, b.dz) - Math.hypot(a.dx, a.dz))[0]
    return longest ? Math.abs(longest.dz) > Math.abs(longest.dx) : false
  }, [vertices])
  const geometry = useMemo(() => {
    const positions = vertices.flat(), uv = vertices.flatMap(([x, , z]) => rotateTexture ? [z / 2, x / 2] : [x / 2, z / 2])
    const shape = new BufferGeometry()
    shape.setAttribute('position', new Float32BufferAttribute(positions, 3))
    shape.setAttribute('uv', new Float32BufferAttribute(uv, 2))
    shape.setIndex(vertices.length === 3 ? [0, 1, 2] : [0, 1, 2, 0, 2, 3])
    shape.computeVertexNormals()
    return shape
  }, [vertices, rotateTexture])
  const sides = useMemo(() => {
    const positions: number[] = []
    for (let index = 0; index < vertices.length; index++) {
      const a = vertices[index], b = vertices[(index + 1) % vertices.length]
      const belowA: Vertex = [a[0], a[1] - .09, a[2]], belowB: Vertex = [b[0], b[1] - .09, b[2]]
      positions.push(...a, ...b, ...belowB, ...a, ...belowB, ...belowA)
    }
    const shape = new BufferGeometry()
    shape.setAttribute('position', new Float32BufferAttribute(positions, 3))
    shape.computeVertexNormals()
    return shape
  }, [vertices])
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => sides.dispose(), [sides])
  return <group><mesh geometry={geometry} castShadow receiveShadow>
    {gable ? <meshStandardMaterial color="#d5d2c8" roughness={.92} side={DoubleSide} /> : roof.material === 'glass'
      ? <meshPhysicalMaterial color={roof.color} metalness={.08} roughness={.12} transmission={.4}
        transparent opacity={.68} side={DoubleSide} depthWrite={false} /> :
      <meshStandardMaterial map={roofTexture(roof.material)} color={roof.color}
        metalness={['standing-seam', 'long-span-metal', 'corrugated', 'stone-coated-metal'].includes(roof.material) ? .28 : .03}
        roughness={roof.material === 'membrane' ? .78 : roof.material === 'standing-seam' ? .4
          : roof.material === 'corrugated' || roof.material === 'long-span-metal' ? .56 : .84} side={DoubleSide} />}
  </mesh>{!gable && <mesh geometry={sides} castShadow receiveShadow>
    <meshStandardMaterial color={roof.color} metalness={.18} roughness={.65} side={DoubleSide} />
  </mesh>}</group>
}

