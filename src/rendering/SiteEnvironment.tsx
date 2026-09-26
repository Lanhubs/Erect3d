import { useMemo } from 'react'
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'
import { Sky } from 'three/addons/objects/Sky.js'
import type { RoofBounds } from '../geometry/roof'

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

export function SiteEnvironment({ bounds, slabThickness }: { bounds: RoofBounds; slabThickness: number }) {
  const sky = useMemo(() => {
    const value = new Sky()
    value.scale.setScalar(450000)
    value.material.uniforms.turbidity.value = 7
    value.material.uniforms.rayleigh.value = 1.5
    value.material.uniforms.mieCoefficient.value = .004
    value.material.uniforms.mieDirectionalG.value = .78
    value.material.uniforms.sunPosition.value.set(-8, 14, 7)
    return value
  }, [])
  const cx = (bounds.minX + bounds.maxX) / 2, cz = (bounds.minZ + bounds.maxZ) / 2
  const width = Math.max(2, bounds.maxX - bounds.minX), depth = Math.max(2, bounds.maxZ - bounds.minZ)
  return <>
    <primitive object={sky} />
    <mesh position={[cx, -slabThickness - .055, cz]} receiveShadow>
      <boxGeometry args={[width + .85, .12, depth + .85]} />
      <meshStandardMaterial color="#898d86" roughness={1} />
    </mesh>
    <mesh position={[cx, -slabThickness - .15, cz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[250, 250]} />
      <meshStandardMaterial map={siteTexture()} roughness={1} />
    </mesh>
  </>
}
