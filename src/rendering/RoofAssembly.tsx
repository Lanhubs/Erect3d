import { useEffect, useMemo } from 'react'
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Quaternion, Vector3 } from 'three'
import type { Roof } from '../domain/types'
import { roofLayout, type RoofBounds, type Vertex } from '../geometry/roof'
import { roofTexture } from './roofTextures'

function Surface({ vertices, roof, gable = false, rotateTexture = false }: { vertices: Vertex[]; roof: Roof; gable?: boolean; rotateTexture?: boolean }) {
  const geometry = useMemo(() => {
    const positions = vertices.flat(), uv = vertices.flatMap(([x, , z]) => rotateTexture ? [z, x] : [x, z])
    const shape = new BufferGeometry()
    shape.setAttribute('position', new Float32BufferAttribute(positions, 3))
    shape.setAttribute('uv', new Float32BufferAttribute(uv, 2))
    shape.setIndex(vertices.length === 3 ? [0, 1, 2] : [0, 1, 2, 0, 2, 3])
    shape.computeVertexNormals()
    return shape
  }, [vertices, rotateTexture])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} castShadow receiveShadow>
    {gable ? <meshStandardMaterial color="#d5d2c8" roughness={.92} side={DoubleSide} /> :
      <meshStandardMaterial map={roofTexture(roof.material)} color={roof.color}
        metalness={roof.material === 'standing-seam' ? .26 : roof.material === 'corrugated' ? .12 : .03}
        roughness={roof.material === 'standing-seam' ? .4 : roof.material === 'corrugated' ? .58 : .84} side={DoubleSide} />}
  </mesh>
}

function Edge({ a, b, radius, color }: { a: Vertex; b: Vertex; radius: number; color: string }) {
  const direction = new Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2])
  const length = direction.length()
  const rotation = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize())
  return <mesh position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]} quaternion={rotation} castShadow>
    <cylinderGeometry args={[radius, radius, length, 8]} />
    <meshStandardMaterial color={color} metalness={.25} roughness={.4} />
  </mesh>
}

export function RoofAssembly({ bounds, roof }: { bounds: RoofBounds; roof: Roof }) {
  const layout = useMemo(() => roofLayout(bounds, roof), [bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ, bounds.top,
    roof.shape, roof.material, roof.color, roof.pitch, roof.overhang])
  const x0 = bounds.minX - roof.overhang, x1 = bounds.maxX + roof.overhang
  const z0 = bounds.minZ - roof.overhang, z1 = bounds.maxZ + roof.overhang
  return <group>
    {layout.faces.map((face, i) => <Surface key={`face-${i}`} vertices={face} roof={roof} rotateTexture={bounds.maxX - bounds.minX < bounds.maxZ - bounds.minZ} />)}
    {layout.gables.map((face, i) => <Surface key={`gable-${i}`} vertices={face} roof={roof} gable />)}
    {layout.eaves.map(([a, b], i) => <Edge key={`eave-${i}`} a={a} b={b} radius={.035} color="#586068" />)}
    {layout.ridge.map(([a, b], i) => <Edge key={`ridge-${i}`} a={a} b={b} radius={.035} color={roof.color} />)}
    {roof.shape === 'hidden' && <>
      <mesh position={[(x0 + x1) / 2, bounds.top + .4, z0]} castShadow><boxGeometry args={[x1 - x0, .55, .22]} /><meshStandardMaterial color="#c8c9c5" roughness={.9} /></mesh>
      <mesh position={[(x0 + x1) / 2, bounds.top + .4, z1]} castShadow><boxGeometry args={[x1 - x0, .55, .22]} /><meshStandardMaterial color="#c8c9c5" roughness={.9} /></mesh>
      <mesh position={[x0, bounds.top + .4, (z0 + z1) / 2]} castShadow><boxGeometry args={[.22, .55, z1 - z0]} /><meshStandardMaterial color="#c8c9c5" roughness={.9} /></mesh>
      <mesh position={[x1, bounds.top + .4, (z0 + z1) / 2]} castShadow><boxGeometry args={[.22, .55, z1 - z0]} /><meshStandardMaterial color="#c8c9c5" roughness={.9} /></mesh>
    </>}
  </group>
}
