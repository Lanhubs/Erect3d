import { useEffect, useMemo } from 'react'
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Quaternion, Vector3 } from 'three'
import type { Point, Roof } from '../domain/types'
import { clipRoofLayout } from '../geometry/roofFootprint'
import { roofOverhang } from '../geometry/roofOverhang'
import { roofLayout, type RoofBounds, type Vertex } from '../geometry/roof'
import { roofTexture } from './roofTextures'
import { CrossRoofSurface } from './CrossRoofSurface'
import { roofClosurePanels } from '../geometry/roofClosure'
import { clipRoofEdges } from '../geometry/roofEdges'

function Surface({ vertices, roof, gable = false }: { vertices: Vertex[]; roof: Roof; gable?: boolean }) {
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

function Fascia({ a, b, depth, color }: { a: Vertex; b: Vertex; depth: number; color: string }) {
  const direction = new Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2])
  const length = direction.length()
  if (length < .01) return null
  const rotation = new Quaternion().setFromUnitVectors(new Vector3(1, 0, 0), direction.normalize())
  return <mesh position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - depth / 2, (a[2] + b[2]) / 2]}
    quaternion={rotation} castShadow receiveShadow>
    <boxGeometry args={[length, depth, .12]} />
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

function RoofFraming({ bounds, roof, spacing, footprint, voids }: { bounds: RoofBounds; roof: Roof; spacing: number; footprint?: Point[]; voids: Point[][] }) {
  if (roof.shape !== 'gable' || spacing <= 0) return null
  const alongX = roof.ridgeDirection === 'x' || roof.ridgeDirection !== 'z' && bounds.maxX - bounds.minX >= bounds.maxZ - bounds.minZ
  const min = alongX ? bounds.minX : bounds.minZ, max = alongX ? bounds.maxX : bounds.maxZ
  const side0 = alongX ? bounds.minZ : bounds.minX, side1 = alongX ? bounds.maxZ : bounds.maxX
  const middle = (side0 + side1) / 2, eave = bounds.top - .18
  const ridge = eave + (side1 - side0) / 2 * Math.tan(roof.pitch * Math.PI / 180)
  const chord = bounds.top - .85
  const positions = Array.from({ length: Math.max(0, Math.floor((max - min) / spacing)) },
    (_, index) => min + (index + .5) * spacing).filter(value => value < max - 1)
  const point = (at: number, side: number, y: number): Vertex => alongX ? [at, y, side] : [side, y, at]
  const member = (a: Vertex, b: Vertex, key: number) => (footprint ? clipRoofEdges([[a, b]], footprint, voids) : [[a, b]]).map(([start, end], i) => <FrameMember key={`${key}:${i}`} a={start} b={end} />)
  return <group>{positions.map(at => <group key={at}>
    {member(point(at, side0, eave), point(at, middle, ridge), 0)}
    {member(point(at, middle, ridge), point(at, side1, eave), 1)}
    {member(point(at, side0, chord), point(at, side1, chord), 2)}
    {member(point(at, middle, chord), point(at, middle, ridge), 3)}
    {member(point(at, side0 + (middle - side0) * .5, chord), point(at, middle, ridge), 4)}
    {member(point(at, side1 - (side1 - middle) * .5, chord), point(at, middle, ridge), 5)}
  </group>)}</group>
}

export function RoofAssembly({ bounds, roof, framingSpacing = 0, footprint, voids = [], infill = true }: { bounds: RoofBounds; roof: Roof; framingSpacing?: number; footprint?: Point[]; voids?: Point[][]; infill?: boolean }) {
  const boundary = useMemo(() => footprint ? roofOverhang(footprint, roof.overhang) : undefined, [footprint, roof.overhang])
  const layout = useMemo(() => {
    const full = roofLayout(bounds, roof)
    return boundary ? clipRoofLayout(full, boundary, voids) : full
  }, [bounds, roof, boundary, voids])
  const closures = useMemo(() => footprint ? roofClosurePanels([footprint, ...voids], layout.faces, bounds.top) : [], [footprint, voids, layout.faces, bounds.top])
  const x0 = bounds.minX - roof.overhang, x1 = bounds.maxX + roof.overhang
  const z0 = bounds.minZ - roof.overhang, z1 = bounds.maxZ + roof.overhang
  return <group>
    <RoofFraming bounds={bounds} roof={roof} spacing={framingSpacing} footprint={footprint} voids={voids} />
    {footprint || roof.shape === 'cross-gable' || roof.shape === 'cross-hip'
      ? <CrossRoofSurface faces={layout.faces} roof={roof} bounds={bounds} infill={!footprint && infill} />
      : layout.faces.map((face, i) => <Surface key={`face-${i}`} vertices={face} roof={roof} />)}
    {infill && (footprint ? closures : layout.gables).map((face, i) => <Surface key={`gable-${i}`} vertices={face} roof={roof} gable />)}
    {layout.eaves.map(([a, b], i) => <Fascia key={`fascia-${i}`} a={a} b={b}
      depth={roof.fasciaDepth ?? .18} color={roof.material === 'clay-tile' ? '#765e50' : '#59666a'} />)}
    {layout.ridge.map(([a, b], i) => <Edge key={`ridge-${i}`} a={a} b={b} radius={.035} color={roof.color} />)}
    {(roof.shape === 'hidden' || roof.shape === 'terrace') && boundary ? [boundary, ...voids].flatMap((ring, ringIndex) => ring.map((a, index) => {
      const b = ring[(index + 1) % ring.length], dx = b.x - a.x, dz = b.z - a.z
      return <mesh key={`parapet-${ringIndex}-${index}`} position={[(a.x + b.x) / 2, bounds.top + .4, (a.z + b.z) / 2]} rotation={[0, -Math.atan2(dz, dx), 0]} castShadow>
        <boxGeometry args={[Math.hypot(dx, dz), .55, .22]} /><meshStandardMaterial color="#c8c9c5" roughness={.9} />
      </mesh>
    })) : (roof.shape === 'hidden' || roof.shape === 'terrace') && <>
      <mesh position={[(x0 + x1) / 2, bounds.top + .4, z0]} castShadow><boxGeometry args={[x1 - x0, .55, .22]} /><meshStandardMaterial color="#c8c9c5" roughness={.9} /></mesh>
      <mesh position={[(x0 + x1) / 2, bounds.top + .4, z1]} castShadow><boxGeometry args={[x1 - x0, .55, .22]} /><meshStandardMaterial color="#c8c9c5" roughness={.9} /></mesh>
      <mesh position={[x0, bounds.top + .4, (z0 + z1) / 2]} castShadow><boxGeometry args={[.22, .55, z1 - z0]} /><meshStandardMaterial color="#c8c9c5" roughness={.9} /></mesh>
      <mesh position={[x1, bounds.top + .4, (z0 + z1) / 2]} castShadow><boxGeometry args={[.22, .55, z1 - z0]} /><meshStandardMaterial color="#c8c9c5" roughness={.9} /></mesh>
    </>}
  </group>
}
