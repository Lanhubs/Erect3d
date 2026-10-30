import { useMemo } from 'react'
import { Quaternion, Vector3 } from 'three'
import type { Point, Roof } from '../domain/types'
import { clipRoofLayout } from '../geometry/roofFootprint'
import { roofOverhang } from '../geometry/roofOverhang'
import { roofLayout, type RoofBounds, type Vertex } from '../geometry/roof'
import { Surface } from './RoofPanelSurface'
import { CrossRoofSurface } from './CrossRoofSurface'
import { roofClosurePanels } from '../geometry/roofClosure'
import { clipRoofEdges } from '../geometry/roofEdges'

function Fascia({ a, b, depth, color }: { a: Vertex; b: Vertex; depth: number; color: string }) {
  const direction = new Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2])
  const length = direction.length()
  if (length < 0.01) return null
  const rotation = new Quaternion().setFromUnitVectors(new Vector3(1, 0, 0), direction.normalize())
  return (
    <mesh
      position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - depth / 2, (a[2] + b[2]) / 2]}
      quaternion={rotation}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[length, depth, 0.12]} />
      <meshStandardMaterial color={color} metalness={0.28} roughness={0.55} />
    </mesh>
  )
}

function Edge({ a, b, radius, color }: { a: Vertex; b: Vertex; radius: number; color: string }) {
  const direction = new Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2])
  const length = direction.length()
  const rotation = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize())
  return (
    <mesh
      position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]}
      quaternion={rotation}
      castShadow
    >
      <cylinderGeometry args={[radius, radius, length, 8]} />
      <meshStandardMaterial color={color} metalness={0.25} roughness={0.4} />
    </mesh>
  )
}

function FrameMember({ a, b }: { a: Vertex; b: Vertex }) {
  const direction = new Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2])
  const length = direction.length()
  const rotation = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize())
  return (
    <mesh
      position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]}
      quaternion={rotation}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[0.16, length, 0.16]} />
      <meshStandardMaterial color="#59666a" metalness={0.58} roughness={0.48} />
    </mesh>
  )
}

function RoofFraming({
  bounds,
  roof,
  spacing,
  footprint,
  voids,
}: {
  bounds: RoofBounds
  roof: Roof
  spacing: number
  footprint?: Point[]
  voids: Point[][]
}) {
  if (roof.shape !== 'gable' || spacing <= 0) return null
  const alongX =
    roof.ridgeDirection === 'x' ||
    (roof.ridgeDirection !== 'z' && bounds.maxX - bounds.minX >= bounds.maxZ - bounds.minZ)
  const min = alongX ? bounds.minX : bounds.minZ,
    max = alongX ? bounds.maxX : bounds.maxZ
  const side0 = alongX ? bounds.minZ : bounds.minX,
    side1 = alongX ? bounds.maxZ : bounds.maxX
  const middle = (side0 + side1) / 2,
    eave = bounds.top - 0.18
  const ridge = eave + ((side1 - side0) / 2) * Math.tan((roof.pitch * Math.PI) / 180)
  const chord = bounds.top - 0.85
  const positions = Array.from(
    { length: Math.max(0, Math.floor((max - min) / spacing)) },
    (_, index) => min + (index + 0.5) * spacing,
  ).filter((value) => value < max - 1)
  const point = (at: number, side: number, y: number): Vertex => (alongX ? [at, y, side] : [side, y, at])
  const member = (a: Vertex, b: Vertex, key: number) =>
    (footprint ? clipRoofEdges([[a, b]], footprint, voids) : [[a, b]]).map(([start, end], i) => (
      <FrameMember key={`${key}:${i}`} a={start} b={end} />
    ))
  return (
    <group>
      {positions.map((at) => (
        <group key={at}>
          {member(point(at, side0, eave), point(at, middle, ridge), 0)}
          {member(point(at, middle, ridge), point(at, side1, eave), 1)}
          {member(point(at, side0, chord), point(at, side1, chord), 2)}
          {member(point(at, middle, chord), point(at, middle, ridge), 3)}
          {member(point(at, side0 + (middle - side0) * 0.5, chord), point(at, middle, ridge), 4)}
          {member(point(at, side1 - (side1 - middle) * 0.5, chord), point(at, middle, ridge), 5)}
        </group>
      ))}
    </group>
  )
}

function ArenaVaultDetails({ bounds, roof }: { bounds: RoofBounds; roof: Roof }) {
  if (roof.shape !== 'arena-vault') return null
  const { minX, maxX, minZ, maxZ, top } = bounds
  const x0 = minX - roof.overhang,
    x1 = maxX + roof.overhang
  const z0 = minZ - roof.overhang,
    z1 = maxZ + roof.overhang
  const alongX = roof.ridgeDirection === 'x' || (roof.ridgeDirection !== 'z' && x1 - x0 >= z1 - z0)
  const span = alongX ? z1 - z0 : x1 - x0,
    len = alongX ? x1 - x0 : z1 - z0,
    half = span / 2
  const pitch = Math.tan((roof.pitch * Math.PI) / 180)
  const rise = Math.max(1.2, Math.min(half * Math.max(0.2, pitch * 1.15), 18))
  const eave = top + (roof.elevationOffset || 0) + 0.12
  const cx = (x0 + x1) / 2,
    cz = (z0 + z1) / 2
  const skylightLen = len * 0.58,
    skylightHalfSpan = half * 0.42,
    skylightGap = 0.35
  const peakY = eave + rise
  const banks = [-1, 1]
  const trussCount = Math.max(4, Math.min(10, Math.floor(len / 6)))
  const trussPositions = Array.from(
    { length: trussCount },
    (_, i) => -len / 2 + (len / (trussCount + 1)) * (i + 1),
  )

  return (
    <group name="arena-vault-details">
      {banks.map((side) => {
        const offset = (skylightHalfSpan / 2 + skylightGap / 2) * side
        const posX = alongX ? cx : cx + offset,
          posZ = alongX ? cz + offset : cz
        const width = alongX ? skylightLen : skylightHalfSpan,
          depth = alongX ? skylightHalfSpan : skylightLen
        const y = peakY - 0.04
        return (
          <group key={`skylight-${side}`} position={[posX, y, posZ]}>
            <mesh position={[0, 0.04, 0]} castShadow>
              <boxGeometry args={[width, 0.06, depth]} />
              <meshPhysicalMaterial
                color="#a8d5e5"
                metalness={0.1}
                roughness={0.08}
                transmission={0.78}
                transparent
                opacity={0.85}
                reflectivity={0.9}
              />
            </mesh>
            {Array.from({ length: 7 }, (_, i) => {
              const frac = -1 + (2 / 6) * i
              const gx = alongX ? frac * (width / 2) : 0,
                gz = alongX ? 0 : frac * (depth / 2)
              return (
                <mesh key={`mullion-v-${i}`} position={[gx, 0.07, gz]} castShadow>
                  <boxGeometry args={[alongX ? 0.08 : width, 0.07, alongX ? depth : 0.08]} />
                  <meshStandardMaterial color="#3a444a" metalness={0.7} roughness={0.35} />
                </mesh>
              )
            })}
            {Array.from({ length: 4 }, (_, i) => {
              const frac = -1 + (2 / 3) * i
              const gx = alongX ? 0 : frac * (width / 2),
                gz = alongX ? frac * (depth / 2) : 0
              return (
                <mesh key={`mullion-h-${i}`} position={[gx, 0.075, gz]} castShadow>
                  <boxGeometry args={[alongX ? width : 0.08, 0.07, alongX ? 0.08 : depth]} />
                  <meshStandardMaterial color="#3a444a" metalness={0.7} roughness={0.35} />
                </mesh>
              )
            })}
          </group>
        )
      })}
      <mesh position={[cx, peakY + 0.06, cz]} castShadow>
        <boxGeometry args={[alongX ? len * 0.7 : 0.4, 0.18, alongX ? 0.4 : len * 0.7]} />
        <meshStandardMaterial color="#475258" metalness={0.65} roughness={0.4} />
      </mesh>
      {trussPositions.map((pos, idx) => {
        const trussX = alongX ? cx + pos : cx,
          trussZ = alongX ? cz : cz + pos,
          segs = 8
        return (
          <group key={`truss-${idx}`} position={[trussX, 0, trussZ]}>
            {Array.from({ length: segs }, (_, s) => {
              const n0 = -1 + (2 / segs) * s,
                n1 = -1 + (2 / segs) * (s + 1)
              const y0 = eave + rise * (1 - n0 * n0) - 0.35,
                y1 = eave + rise * (1 - n1 * n1) - 0.35
              const s0 = n0 * half,
                s1 = n1 * half
              const midS = (s0 + s1) / 2,
                midY = (y0 + y1) / 2
              const segLen = Math.hypot(s1 - s0, y1 - y0),
                angle = Math.atan2(y1 - y0, s1 - s0)
              return (
                <mesh
                  key={`seg-${s}`}
                  position={[alongX ? 0 : midS, midY, alongX ? midS : 0]}
                  rotation={[0, alongX ? 0 : -Math.PI / 2, alongX ? angle : angle]}
                  castShadow
                >
                  <boxGeometry args={[alongX ? 0.18 : segLen, 0.18, alongX ? segLen : 0.18]} />
                  <meshStandardMaterial color="#404c52" metalness={0.6} roughness={0.45} />
                </mesh>
              )
            })}
          </group>
        )
      })}
    </group>
  )
}

export function RoofAssembly({
  bounds,
  roof,
  framingSpacing = 0,
  footprint,
  voids = [],
  closureRings,
  infill = true,
}: {
  bounds: RoofBounds
  roof: Roof
  framingSpacing?: number
  footprint?: Point[]
  voids?: Point[][]
  closureRings?: Point[][]
  infill?: boolean
}) {
  const boundary = useMemo(
    () => (footprint ? roofOverhang(footprint, roof.overhang) : undefined),
    [footprint, roof.overhang],
  )
  const layout = useMemo(() => {
    const full = roofLayout(bounds, roof)
    return boundary ? clipRoofLayout(full, boundary, voids) : full
  }, [bounds, roof, boundary, voids])
  const closures = useMemo(
    () =>
      footprint ? roofClosurePanels(closureRings || [footprint, ...voids], layout.faces, bounds.top) : [],
    [footprint, voids, closureRings, layout.faces, bounds.top],
  )
  const x0 = bounds.minX - roof.overhang,
    x1 = bounds.maxX + roof.overhang
  const z0 = bounds.minZ - roof.overhang,
    z1 = bounds.maxZ + roof.overhang
  return (
    <group>
      <RoofFraming bounds={bounds} roof={roof} spacing={framingSpacing} footprint={footprint} voids={voids} />
      {footprint || roof.shape === 'cross-gable' || roof.shape === 'cross-hip' ? (
        <CrossRoofSurface faces={layout.faces} roof={roof} bounds={bounds} infill={!footprint && infill} />
      ) : (
        layout.faces.map((face, i) => <Surface key={`face-${i}`} vertices={face} roof={roof} />)
      )}
      {infill &&
        (footprint ? closures : layout.gables).map((face, i) => (
          <Surface key={`gable-${i}`} vertices={face} roof={roof} gable />
        ))}
      {layout.eaves.map(([a, b], i) => (
        <Fascia
          key={`fascia-${i}`}
          a={a}
          b={b}
          depth={roof.fasciaDepth ?? 0.18}
          color={roof.material === 'clay-tile' ? '#765e50' : '#59666a'}
        />
      ))}
      {layout.ridge.map(([a, b], i) => (
        <Edge key={`ridge-${i}`} a={a} b={b} radius={0.035} color={roof.color} />
      ))}
      <ArenaVaultDetails bounds={bounds} roof={roof} />
      {(roof.shape === 'hidden' || roof.shape === 'terrace') && boundary
        ? [boundary, ...voids].flatMap((ring, ringIndex) =>
            ring.map((a, index) => {
              const b = ring[(index + 1) % ring.length],
                dx = b.x - a.x,
                dz = b.z - a.z
              return (
                <mesh
                  key={`parapet-${ringIndex}-${index}`}
                  position={[(a.x + b.x) / 2, bounds.top + 0.4, (a.z + b.z) / 2]}
                  rotation={[0, -Math.atan2(dz, dx), 0]}
                  castShadow
                >
                  <boxGeometry args={[Math.hypot(dx, dz), 0.55, 0.22]} />
                  <meshStandardMaterial color="#c8c9c5" roughness={0.9} />
                </mesh>
              )
            }),
          )
        : (roof.shape === 'hidden' || roof.shape === 'terrace') && (
            <>
              <mesh position={[(x0 + x1) / 2, bounds.top + 0.4, z0]} castShadow>
                <boxGeometry args={[x1 - x0, 0.55, 0.22]} />
                <meshStandardMaterial color="#c8c9c5" roughness={0.9} />
              </mesh>
              <mesh position={[(x0 + x1) / 2, bounds.top + 0.4, z1]} castShadow>
                <boxGeometry args={[x1 - x0, 0.55, 0.22]} />
                <meshStandardMaterial color="#c8c9c5" roughness={0.9} />
              </mesh>
              <mesh position={[x0, bounds.top + 0.4, (z0 + z1) / 2]} castShadow>
                <boxGeometry args={[0.22, 0.55, z1 - z0]} />
                <meshStandardMaterial color="#c8c9c5" roughness={0.9} />
              </mesh>
              <mesh position={[x1, bounds.top + 0.4, (z0 + z1) / 2]} castShadow>
                <boxGeometry args={[0.22, 0.55, z1 - z0]} />
                <meshStandardMaterial color="#c8c9c5" roughness={0.9} />
              </mesh>
            </>
          )}
    </group>
  )
}
