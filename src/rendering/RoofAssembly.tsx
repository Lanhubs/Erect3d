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
    {gable ? <meshStandardMaterial color="#d5d2c8" roughness={.92} side={DoubleSide} /> : roof.material === 'glass'
      ? <meshPhysicalMaterial color={roof.color} metalness={.08} roughness={.12} transmission={.4}
        transparent opacity={.68} side={DoubleSide} depthWrite={false} /> :
      <meshStandardMaterial map={roofTexture(roof.material)} color={roof.color}
        metalness={['standing-seam', 'long-span-metal', 'corrugated', 'stone-coated-metal'].includes(roof.material) ? .28 : .03}
        roughness={roof.material === 'membrane' ? .78 : roof.material === 'standing-seam' ? .4
          : roof.material === 'corrugated' || roof.material === 'long-span-metal' ? .56 : .84} side={DoubleSide} />}
  </mesh>
}

function Fascia({ a, b, depth, color }: { a: Vertex; b: Vertex; depth: number; color: string }) {
  const dx = b[0] - a[0], dz = b[2] - a[2]
  const length = Math.hypot(dx, dz)
  if (length < .01) return null
  return <mesh position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - depth / 2, (a[2] + b[2]) / 2]}
    rotation={[0, -Math.atan2(dz, dx), 0]} castShadow>
    <boxGeometry args={[length, depth, .09]} />
    <meshStandardMaterial color={color} metalness={.28} roughness={.55} />
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

function FrameMember({ a, b }: { a: Vertex; b: Vertex }) {
  const direction = new Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2])
  const length = direction.length()
  const rotation = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize())
  return <mesh position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]}
    quaternion={rotation} castShadow receiveShadow>
    <boxGeometry args={[.16, length, .16]} />
    <meshStandardMaterial color="#59666a" metalness={.58} roughness={.48} />
  </mesh>
}

function RoofFraming({ bounds, roof, spacing }: { bounds: RoofBounds; roof: Roof; spacing: number }) {
  if (roof.shape !== 'gable' || spacing <= 0) return null
  const alongX = bounds.maxX - bounds.minX >= bounds.maxZ - bounds.minZ
  const min = alongX ? bounds.minX : bounds.minZ, max = alongX ? bounds.maxX : bounds.maxZ
  const side0 = alongX ? bounds.minZ : bounds.minX, side1 = alongX ? bounds.maxZ : bounds.maxX
  const middle = (side0 + side1) / 2, eave = bounds.top - .18
  const ridge = eave + (side1 - side0) / 2 * Math.tan(roof.pitch * Math.PI / 180)
  const chord = bounds.top - .85
  const positions = Array.from({ length: Math.max(0, Math.floor((max - min) / spacing)) },
    (_, index) => min + (index + .5) * spacing).filter(value => value < max - 1)
  const point = (at: number, side: number, y: number): Vertex => alongX ? [at, y, side] : [side, y, at]
  return <group>{positions.map(at => <group key={at}>
    <FrameMember a={point(at, side0, eave)} b={point(at, middle, ridge)} />
    <FrameMember a={point(at, middle, ridge)} b={point(at, side1, eave)} />
    <FrameMember a={point(at, side0, chord)} b={point(at, side1, chord)} />
    <FrameMember a={point(at, middle, chord)} b={point(at, middle, ridge)} />
    <FrameMember a={point(at, side0 + (middle - side0) * .5, chord)} b={point(at, middle, ridge)} />
    <FrameMember a={point(at, side1 - (side1 - middle) * .5, chord)} b={point(at, middle, ridge)} />
  </group>)}</group>
}

export function RoofAssembly({ bounds, roof, framingSpacing = 0 }: { bounds: RoofBounds; roof: Roof; framingSpacing?: number }) {
  const layout = useMemo(() => roofLayout(bounds, roof), [bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ, bounds.top,
    roof.shape, roof.material, roof.color, roof.pitch, roof.overhang, roof.ridgeDirection, roof.elevationOffset])
  const x0 = bounds.minX - roof.overhang, x1 = bounds.maxX + roof.overhang
  const z0 = bounds.minZ - roof.overhang, z1 = bounds.maxZ + roof.overhang
  return <group>
    <RoofFraming bounds={bounds} roof={roof} spacing={framingSpacing} />
    {layout.faces.map((face, i) => <Surface key={`face-${i}`} vertices={face} roof={roof} rotateTexture={bounds.maxX - bounds.minX < bounds.maxZ - bounds.minZ} />)}
    {layout.gables.map((face, i) => <Surface key={`gable-${i}`} vertices={face} roof={roof} gable />)}
    {layout.eaves.map(([a, b], i) => <Edge key={`eave-${i}`} a={a} b={b} radius={.035} color="#586068" />)}
    {layout.eaves.map(([a, b], i) => <Fascia key={`fascia-${i}`} a={a} b={b}
      depth={roof.fasciaDepth ?? .18} color={roof.material === 'clay-tile' ? '#765e50' : '#59666a'} />)}
    {layout.ridge.map(([a, b], i) => <Edge key={`ridge-${i}`} a={a} b={b} radius={.035} color={roof.color} />)}
    {(roof.shape === 'hidden' || roof.shape === 'terrace') && <>
      <mesh position={[(x0 + x1) / 2, bounds.top + .4, z0]} castShadow><boxGeometry args={[x1 - x0, .55, .22]} /><meshStandardMaterial color="#c8c9c5" roughness={.9} /></mesh>
      <mesh position={[(x0 + x1) / 2, bounds.top + .4, z1]} castShadow><boxGeometry args={[x1 - x0, .55, .22]} /><meshStandardMaterial color="#c8c9c5" roughness={.9} /></mesh>
      <mesh position={[x0, bounds.top + .4, (z0 + z1) / 2]} castShadow><boxGeometry args={[.22, .55, z1 - z0]} /><meshStandardMaterial color="#c8c9c5" roughness={.9} /></mesh>
      <mesh position={[x1, bounds.top + .4, (z0 + z1) / 2]} castShadow><boxGeometry args={[.22, .55, z1 - z0]} /><meshStandardMaterial color="#c8c9c5" roughness={.9} /></mesh>
    </>}
  </group>
}
