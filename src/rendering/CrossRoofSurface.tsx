import { useEffect, useMemo } from 'react'
import { BufferGeometry, DoubleSide, Float32BufferAttribute } from 'three'
import type { Roof } from '../domain/types'
import type { RoofBounds, RoofFace, Vertex } from '../geometry/roof'
import { crossRoofHeightAt } from '../geometry/crossRoof'
import { roofTexture } from './roofTextures'

function edgeKey(a: Vertex, b: Vertex) {
  const point = (v: Vertex) => v.map(value => value.toFixed(5)).join(',')
  const first = point(a), second = point(b)
  return first < second ? `${first}|${second}` : `${second}|${first}`
}

function shellGeometry(faces: RoofFace[]) {
  const edges = new Map<string, { a: Vertex; b: Vertex; count: number }>()
  for (const face of faces) for (let index = 0; index < face.length; index++) {
    const a = face[index], b = face[(index + 1) % face.length]
    const key = edgeKey(a, b), existing = edges.get(key)
    if (existing) existing.count++
    else edges.set(key, { a, b, count: 1 })
  }
  const positions: number[] = []
  for (const { a, b, count } of edges.values()) {
    if (count !== 1) continue
    const belowA: Vertex = [a[0], a[1] - .1, a[2]]
    const belowB: Vertex = [b[0], b[1] - .1, b[2]]
    positions.push(...a, ...b, ...belowB, ...a, ...belowB, ...belowA)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  return geometry
}

function endPanels(bounds: RoofBounds, roof: Roof) {
  const positions: number[] = []
  const side = (start: [number, number], end: [number, number]) => {
    const count = Math.max(2, Math.ceil(Math.hypot(end[0] - start[0], end[1] - start[1]) / .35))
    for (let index = 0; index < count; index++) {
      const point = (step: number): Vertex => {
        const t = step / count
        const x = start[0] + (end[0] - start[0]) * t
        const z = start[1] + (end[1] - start[1]) * t
        return [x, crossRoofHeightAt(bounds, roof, x, z) - .035, z]
      }
      const a = point(index), b = point(index + 1)
      const bottomA: Vertex = [a[0], bounds.top, a[2]]
      const bottomB: Vertex = [b[0], bounds.top, b[2]]
      positions.push(...a, ...bottomA, ...b, ...b, ...bottomA, ...bottomB)
    }
  }
  side([bounds.minX, bounds.minZ], [bounds.maxX, bounds.minZ])
  side([bounds.maxX, bounds.minZ], [bounds.maxX, bounds.maxZ])
  side([bounds.maxX, bounds.maxZ], [bounds.minX, bounds.maxZ])
  side([bounds.minX, bounds.maxZ], [bounds.minX, bounds.minZ])
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  return geometry
}

export function CrossRoofSurface({ faces, roof, bounds, infill = true }: { faces: RoofFace[]; roof: Roof; bounds: RoofBounds; infill?: boolean }) {
  const geometry = useMemo(() => {
    const positions: number[] = [], uv: number[] = []
    for (const face of faces) {
      const [a, b, c] = face
      const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
      const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
      const slopeX = Math.abs(ab[1] * ac[2] - ab[2] * ac[1])
      const slopeZ = Math.abs(ab[0] * ac[1] - ab[1] * ac[0])
      for (const [x, y, z] of face) {
        positions.push(x, y, z)
        uv.push(slopeX > slopeZ ? z / 2 : x / 2, slopeX > slopeZ ? x / 2 : z / 2)
      }
    }
    const mesh = new BufferGeometry()
    mesh.setAttribute('position', new Float32BufferAttribute(positions, 3))
    mesh.setAttribute('uv', new Float32BufferAttribute(uv, 2))
    mesh.computeVertexNormals()
    return mesh
  }, [faces])
  const sides = useMemo(() => shellGeometry(faces), [faces])
  const panels = useMemo(() => endPanels(bounds, roof), [bounds, roof])
  useEffect(() => () => { geometry.dispose(); sides.dispose(); panels.dispose() }, [geometry, sides, panels])
  return <group>
    <mesh geometry={geometry} castShadow receiveShadow>
      {roof.material === 'glass'
        ? <meshPhysicalMaterial color={roof.color} metalness={.08} roughness={.12}
          transmission={.4} transparent opacity={.68} side={DoubleSide} depthWrite={false} />
        : <meshStandardMaterial map={roofTexture(roof.material)} color={roof.color}
          metalness={['standing-seam', 'long-span-metal', 'corrugated', 'stone-coated-metal'].includes(roof.material) ? .28 : .03}
          roughness={roof.material === 'membrane' ? .78 : .56} side={DoubleSide} />}
    </mesh>
    <mesh geometry={sides} castShadow receiveShadow>
      <meshStandardMaterial color={roof.color} metalness={.18} roughness={.65} side={DoubleSide} />
    </mesh>
    {infill && <mesh geometry={panels} castShadow receiveShadow>
      <meshStandardMaterial color="#d5d2c8" roughness={.92} side={DoubleSide} />
    </mesh>}
  </group>
}
