import {useEffect,useLayoutEffect,useMemo,useRef} from 'react'
import {BoxGeometry,DoubleSide,InstancedMesh,Matrix4,Object3D,Shape,ShapeGeometry} from 'three'
import type {Point,SiteFence} from '../domain/types'
function pointOnSegment(start: { x: number; z: number }, end: { x: number; z: number }, distance: number) {
  const dx = end.x - start.x, dz = end.z - start.z
  const length = Math.hypot(dx, dz) || 1
  const ratio = Math.max(0, Math.min(1, distance / length))
  return { x: start.x + dx * ratio, z: start.z + dz * ratio }
}

type FencePart = { start: { x: number; z: number }; end: { x: number; z: number }; height: number; thickness: number; color: string }

function InstancedMetalFence({ parts, color }: { parts: FencePart[]; color: string }) {
  const mesh = useRef<InstancedMesh>(null)
  const geometry = useMemo(() => new BoxGeometry(1, 1, 1), [])
  const transforms = useMemo(() => parts.flatMap(part => {
    const dx = part.end.x - part.start.x, dz = part.end.z - part.start.z
    const length = Math.hypot(dx, dz), angle = Math.atan2(dz, dx)
    const centerX = (part.start.x + part.end.x) / 2, centerZ = (part.start.z + part.end.z) / 2
    const items: Array<{ x: number; y: number; z: number; width: number; height: number; depth: number }> = []
    for (const y of [.12, part.height * .52, part.height - .12])
      items.push({ x: centerX, y, z: centerZ, width: length, height: .045, depth: .045 })
    const posts = Math.max(1, Math.ceil(length / 1.8))
    for (let index = 0; index <= posts; index++) {
      const distance = length * index / posts
      items.push({ x: part.start.x + Math.cos(angle) * distance, y: part.height / 2,
        z: part.start.z + Math.sin(angle) * distance, width: .08, height: part.height, depth: .08 })
    }
    for (let distance = .14; distance < length - .08; distance += .14)
      items.push({ x: part.start.x + Math.cos(angle) * distance, y: part.height / 2,
        z: part.start.z + Math.sin(angle) * distance, width: .025, height: part.height - .08, depth: .025 })
    return items.map(item => ({ ...item, angle }))
  }), [parts])
  useLayoutEffect(() => {
    const target = mesh.current
    if (!target) return
    const object = new Object3D(), matrix = new Matrix4()
    transforms.forEach((item, index) => {
      object.position.set(item.x, item.y, item.z)
      object.rotation.set(0, -item.angle, 0)
      object.scale.set(item.width, item.height, item.depth)
      object.updateMatrix()
      matrix.copy(object.matrix)
      target.setMatrixAt(index, matrix)
    })
    target.instanceMatrix.needsUpdate = true
    target.computeBoundingSphere()
  }, [transforms])
  return <instancedMesh ref={mesh} args={[geometry, undefined, transforms.length]} castShadow receiveShadow>
    <meshStandardMaterial color={color} metalness={.62} roughness={.4} />
  </instancedMesh>
}

export function PlotSurface({ boundary, y }: { boundary: Point[]; y: number }) {
  const geometry = useMemo(() => {
    const shape = new Shape()
    boundary.forEach((point, index) => index ? shape.lineTo(point.x, -point.z) : shape.moveTo(point.x, -point.z))
    shape.closePath()
    return new ShapeGeometry(shape)
  }, [boundary])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
    <meshStandardMaterial color="#9da692" roughness={.98} side={DoubleSide} />
  </mesh>
}

export function FenceMesh({ siteFence, onSelect }: { siteFence?: SiteFence; onSelect?: () => void }) {
  if (!siteFence || siteFence.enabled === false) return null
  const segments = siteFence.segments.flatMap(segment => {
    const totalLength = Math.hypot(segment.end.x - segment.start.x, segment.end.z - segment.start.z)
    const gates = [...siteFence.gates].filter(item => item.segmentId === segment.id).sort((a, b) => a.offset - b.offset)
    const parts: Array<{ start: { x: number; z: number }; end: { x: number; z: number }; height: number; thickness: number; color: string }> = []
    let cursor = 0
    for (const gate of gates) {
      const next = gate.offset
      const end = gate.offset + gate.width
      if (cursor < next - .001) parts.push({ start: pointOnSegment(segment.start, segment.end, cursor), end: pointOnSegment(segment.start, segment.end, next), height: segment.height, thickness: segment.thickness, color: segment.color || siteFence.color || '#a7a39d' })
      cursor = Math.max(cursor, end)
    }
    if (totalLength - cursor > .001) parts.push({ start: pointOnSegment(segment.start, segment.end, cursor), end: segment.end, height: segment.height, thickness: segment.thickness, color: segment.color || siteFence.color || '#a7a39d' })
    return parts
  })
  const gates = siteFence.gates.flatMap(gate => {
    const segment = siteFence.segments.find(item => item.id === gate.segmentId)
    if (!segment) return []
    const start = pointOnSegment(segment.start, segment.end, gate.offset)
    const end = pointOnSegment(segment.start, segment.end, gate.offset + gate.width)
    const axis = Math.atan2(end.z - start.z, end.x - start.x)
    const centerX = (start.x + end.x) / 2, centerZ = (start.z + end.z) / 2
    return [
      <group key={`gate-post-${gate.id}-a`} position={[start.x, gate.height / 2, start.z]} rotation={[0, -axis, 0]}>
        <mesh castShadow receiveShadow><boxGeometry args={[.08, gate.height, .08]} /><meshStandardMaterial color={gate.color || siteFence.color || '#6b6a68'} metalness={.65} roughness={.38} /></mesh>
      </group>,
      <group key={`gate-post-${gate.id}-b`} position={[end.x, gate.height / 2, end.z]} rotation={[0, -axis, 0]}>
        <mesh castShadow receiveShadow><boxGeometry args={[.08, gate.height, .08]} /><meshStandardMaterial color={gate.color || siteFence.color || '#6b6a68'} metalness={.65} roughness={.38} /></mesh>
      </group>,
      <group key={`gate-${gate.id}`} position={[centerX, gate.height * .62, centerZ]} rotation={[0, -axis, 0]}>
        <mesh castShadow receiveShadow><boxGeometry args={[Math.max(.45, gate.width), .06, .06]} /><meshStandardMaterial color={gate.color || siteFence.color || '#6b6a68'} metalness={.55} roughness={.46} /></mesh>
        {gate.kind === 'vehicle' && <mesh position={[0, -.25, .18]} castShadow receiveShadow><boxGeometry args={[Math.max(.4, gate.width * .72), .06, .06]} /><meshStandardMaterial color={gate.color || siteFence.color || '#6b6a68'} metalness={.55} roughness={.46} /></mesh>}
      </group>,
    ]
  })
  return <group onClick={event => { if (onSelect) { event.stopPropagation(); onSelect() } }}>{siteFence.material === 'metal' ? <InstancedMetalFence parts={segments} color={siteFence.color || '#68716e'} /> : segments.map((part, index) => {
    const dx = part.end.x - part.start.x, dz = part.end.z - part.start.z
    const length = Math.hypot(dx, dz) || .001
    const centerX = (part.start.x + part.end.x) / 2, centerZ = (part.start.z + part.end.z) / 2
    const angle = Math.atan2(dz, dx)
    return <mesh key={`fence-${index}`} position={[centerX, part.height / 2, centerZ]} rotation={[0, -angle, 0]} castShadow receiveShadow>
      <boxGeometry args={[length, part.height, part.thickness]} />
      <meshStandardMaterial color={part.color} metalness={siteFence.material === 'metal' ? .55 : .02}
        roughness={siteFence.material === 'metal' ? .42 : .86} />
    </mesh>
  })}{siteFence.material !== 'metal' && segments.filter(() => siteFence.material === 'concrete' || siteFence.material === 'brick').map((part, index) => {
    const dx = part.end.x - part.start.x, dz = part.end.z - part.start.z
    const length = Math.hypot(dx, dz) || .001
    return <mesh key={`fence-cap-${index}`} position={[(part.start.x + part.end.x) / 2, part.height + .025, (part.start.z + part.end.z) / 2]}
      rotation={[0, -Math.atan2(dz, dx), 0]} castShadow receiveShadow>
      <boxGeometry args={[length + .04, .05, part.thickness + .06]} />
      <meshStandardMaterial color={siteFence.color || (siteFence.material === 'brick' ? '#9b765f' : '#aaa9a2')} roughness={.78} />
    </mesh>
  })}{gates}</group>
}

