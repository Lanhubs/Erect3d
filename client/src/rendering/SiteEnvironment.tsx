import {FenceMesh,PlotSurface} from './FenceScene'
import { useMemo } from 'react'
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'
import { Sky } from 'three/addons/objects/Sky.js'
import {SkyMesh} from 'three/addons/objects/SkyMesh.js'
import {useThree} from '@react-three/fiber'
import type { SiteFence } from '../domain/types'
import type { RoofBounds } from '../geometry/roof'
import { siteBounds } from '../geometry/site'
import {SitePropInstances} from './SitePropInstances'
import {useGraphicsSettings} from './GraphicsRuntime'

let groundMap: CanvasTexture | undefined
function siteTexture() {
  if (groundMap) return groundMap
  const canvas = document.createElement('canvas')
  canvas.width = 256; canvas.height = 256
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#b8c2ac'; ctx.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 2400; i++) {
    const x = (i * 139) % 256, y = (i * 71) % 256
    ctx.fillStyle = i % 3 ? 'rgba(76,96,63,.055)' : 'rgba(240,239,205,.07)'
    ctx.fillRect(x, y, 2 + i % 3, 1 + i % 2)
  }
  groundMap = new CanvasTexture(canvas)
  groundMap.wrapS = RepeatWrapping; groundMap.wrapT = RepeatWrapping
  groundMap.repeat.set(90, 90); groundMap.colorSpace = SRGBColorSpace
  groundMap.anisotropy = 4
  return groundMap
}

function CivicPlazaLandscape({ cx, cz, width, depth, slabThickness }: { cx: number; cz: number; width: number; depth: number; slabThickness: number }) {
  const {optimized}=useGraphicsSettings()
  const plazaW = width + 24, plazaD = depth + 22
  const y = -slabThickness - 0.035
  const parkingW = 16, parkingD = Math.max(18, depth * 0.7)
  const leftParkX = cx - width / 2 - parkingW / 2 - 4
  const rightParkX = cx + width / 2 + parkingW / 2 + 4

  const trees: Array<[number, number]> = useMemo(() => {
    const pts: Array<[number, number]> = []
    for (let x = cx - plazaW / 2 + 3; x <= cx + plazaW / 2 - 3; x += 6.5) {
      pts.push([x, cz - plazaD / 2 + 3], [x, cz - plazaD / 2 - 4])
    }
    for (let x = cx - plazaW / 2 + 4; x <= cx + plazaW / 2 - 4; x += 8) {
      if (Math.abs(x - cx) > 10) pts.push([x, cz + plazaD / 2 + 4])
    }
    for (let z = cz - parkingD / 2 + 5; z <= cz + parkingD / 2 - 5; z += 7.5) {
      pts.push([leftParkX - parkingW / 2 - 3, z], [rightParkX + parkingW / 2 + 3, z])
    }
    return pts
  }, [cx, cz, plazaW, plazaD, leftParkX, rightParkX, parkingW, parkingD])

  const cars: Array<{ x: number; z: number; color: string }> = useMemo(() => {
    const list: Array<{ x: number; z: number; color: string }> = []
    const palette = ['#f8fafc', '#1e293b', '#64748b', '#0f172a', '#94a3b8', '#1e3a8a', '#991b1b']
    for (const px of [leftParkX, rightParkX]) {
      for (let z = cz - parkingD / 2 + 3; z <= cz + parkingD / 2 - 3; z += 3.2) {
        for (const dx of [-3.8, 3.8]) {
          list.push({ x: px + dx, z, color: palette[(Math.abs(Math.round(px + z * 3))) % palette.length] })
        }
      }
    }
    return list
  }, [leftParkX, rightParkX, cz, parkingD])

  if (width < 14 && depth < 14) return null
  return <group name="civic-plaza-environment">
    <mesh position={[cx, y, cz]} receiveShadow>
      <boxGeometry args={[plazaW, 0.05, plazaD]} />
      <meshStandardMaterial color="#d4d7cf" roughness={0.88} />
    </mesh>
    <mesh position={[cx, y + 0.005, cz + depth / 2 + 8]} receiveShadow>
      <boxGeometry args={[width * 0.65, 0.05, 16]} />
      <meshStandardMaterial color="#e2e8f0" roughness={0.8} />
    </mesh>
    {[leftParkX, rightParkX].map((px, i) => (
      <group key={`parking-lot-${i}`} position={[px, y + 0.01, cz]}>
        <mesh receiveShadow>
          <boxGeometry args={[parkingW, 0.04, parkingD]} />
          <meshStandardMaterial color="#2d3339" roughness={0.92} />
        </mesh>
        {Array.from({ length: Math.floor(parkingD / 3.2) }, (_, row) => {
          const z = -parkingD / 2 + 2.4 + row * 3.2
          return <mesh key={`stall-${row}`} position={[0, 0.025, z]}>
            <boxGeometry args={[parkingW * 0.85, 0.008, 0.12]} />
            <meshBasicMaterial color="#f8fafc" />
          </mesh>
        })}
      </group>
    ))}
    {optimized && <SitePropInstances cars={cars} trees={trees} y={y}/>}
    {!optimized && cars.map((car, i) => (
      <group key={`car-${i}`} position={[car.x, y + 0.5, car.z]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[3.8, 1.1, 1.9]} />
          <meshStandardMaterial color={car.color} roughness={0.3} metalness={0.7} />
        </mesh>
        <mesh position={[-0.2, 0.65, 0]} castShadow>
          <boxGeometry args={[2.0, 0.6, 1.65]} />
          <meshStandardMaterial color="#0f172a" roughness={0.1} metalness={0.8} />
        </mesh>
      </group>
    ))}
    {!optimized && trees.map(([tx, tz], i) => (
      <group key={`tree-${i}`} position={[tx, y + 0.03, tz]}>
        <mesh position={[0, 1.6, 0]} castShadow>
          <cylinderGeometry args={[0.22, 0.32, 3.2, 8]} />
          <meshStandardMaterial color="#4a3728" roughness={0.9} />
        </mesh>
        <mesh position={[0, 4.2, 0]} castShadow>
          <coneGeometry args={[2.4, 4.2, 8]} />
          <meshStandardMaterial color={i % 2 === 0 ? "#2e5a27" : "#3b6d32"} roughness={0.85} />
        </mesh>
        <mesh position={[0, 3.2, 0]} castShadow>
          <coneGeometry args={[2.8, 3.0, 8]} />
          <meshStandardMaterial color="#264e20" roughness={0.85} />
        </mesh>
      </group>
    ))}
  </group>
}

export function SiteEnvironment({ bounds, slabThickness, siteFence, baseShown = true, onFenceSelect,contextShown=false }: { bounds: RoofBounds; slabThickness: number; siteFence?: SiteFence; baseShown?: boolean; onFenceSelect?: () => void;contextShown?:boolean }) {
  const native=Boolean((useThree(state=>state.gl) as unknown as {isWebGPURenderer?:boolean}).isWebGPURenderer)
  const sky = useMemo(() => {
    if(native){const value=new SkyMesh();value.scale.setScalar(10000);value.turbidity.value=4;value.rayleigh.value=1.5;value.sunPosition.value.set(-8,14,7);return value}
    const value = new Sky()
    value.scale.setScalar(450000)
    value.material.uniforms.turbidity.value = 7
    value.material.uniforms.rayleigh.value = 1.5
    value.material.uniforms.mieCoefficient.value = .004
    value.material.uniforms.mieDirectionalG.value = .78
    value.material.uniforms.sunPosition.value.set(-8, 14, 7)
    return value
  }, [native])
  const cx = (bounds.minX + bounds.maxX) / 2, cz = (bounds.minZ + bounds.maxZ) / 2
  const width = Math.max(2, bounds.maxX - bounds.minX), depth = Math.max(2, bounds.maxZ - bounds.minZ)
  const plot = siteBounds(siteFence)
  const groundCenterX = plot ? (plot.minX + plot.maxX) / 2 : cx
  const groundCenterZ = plot ? (plot.minZ + plot.maxZ) / 2 : cz
  const groundWidth = plot ? Math.max(2, plot.maxX - plot.minX) : width + .85
  const groundDepth = plot ? Math.max(2, plot.maxZ - plot.minZ) : depth + .85
  const plotBoundary = plot ? siteFence?.boundary?.length ? siteFence.boundary : siteFence?.segments.map(segment => segment.start) : undefined
  return <>
    <primitive object={sky} />
    {plotBoundary && plotBoundary.length >= 3 ? <PlotSurface boundary={plotBoundary} y={-slabThickness} /> : baseShown && <mesh position={[groundCenterX, -slabThickness - .055, groundCenterZ]} receiveShadow>
      <boxGeometry args={[groundWidth, .12, groundDepth]} />
      <meshStandardMaterial color={plot ? '#90958c' : '#898d86'} roughness={.96} />
    </mesh>}
    {contextShown&&<CivicPlazaLandscape cx={cx} cz={cz} width={width} depth={depth} slabThickness={slabThickness} />}
    <mesh position={[groundCenterX, -slabThickness - (baseShown ? .15 : .015), groundCenterZ]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[250, 250]} />
      <meshStandardMaterial map={siteTexture()} roughness={1} />
    </mesh>
    <FenceMesh siteFence={siteFence} onSelect={onFenceSelect} />
  </>
}
