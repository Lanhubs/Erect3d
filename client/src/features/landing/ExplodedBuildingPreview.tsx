import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { PCFShadowMap, type Group } from 'three'

function Part({ position, size, color, roughness = .8, metalness = 0 }: {
  position: [number, number, number]; size: [number, number, number]; color: string; roughness?: number; metalness?: number
}) {
  return <mesh position={position} castShadow receiveShadow>
    <boxGeometry args={size} /><meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />
  </mesh>
}

function WindowUnit() {
  return <group position={[5.25, 2.1, .25]} rotation={[0, Math.PI / 2, 0]}>
    <Part position={[-.62, 0, 0]} size={[.09, 1.3, .13]} color="#56615d" metalness={.4} />
    <Part position={[.62, 0, 0]} size={[.09, 1.3, .13]} color="#56615d" metalness={.4} />
    <Part position={[0, .61, 0]} size={[1.3, .09, .13]} color="#56615d" metalness={.4} />
    <Part position={[0, -.61, 0]} size={[1.3, .09, .13]} color="#56615d" metalness={.4} />
    <Part position={[0, 0, -.025]} size={[1.12, 1.1, .035]} color="#83a9ae" roughness={.22} metalness={.18} />
    <Part position={[0, 0, .06]} size={[.035, 1.1, .055]} color="#56615d" metalness={.4} />
  </group>
}

function DoorUnit() {
  return <group position={[5, 1.45, 4.1]}>
    <Part position={[-.58, 1.42, 0]} size={[.12, 2.84, .16]} color="#5b5145" />
    <Part position={[.58, 1.42, 0]} size={[.12, 2.84, .16]} color="#5b5145" />
    <Part position={[0, 2.78, 0]} size={[1.28, .12, .16]} color="#5b5145" />
    <Part position={[0, 1.4, .02]} size={[1, 2.65, .12]} color="#866c4f" roughness={.66} />
    <Part position={[.34, 1.4, .1]} size={[.045, .045, .06]} color="#d4bd8f" metalness={.62} roughness={.32} />
  </group>
}

function SiteFence() {
  const dark = '#596863'
  const posts: [number, number, number][] = []
  for (let x = -6.5; x <= 6.51; x += 1.3) {
    posts.push([x, .05, -4.25])
    if (Math.abs(x) > 1.6) posts.push([x, .05, 4.25])
  }
  for (let z = -3.25; z <= 3.26; z += 1.3) {
    posts.push([-6.5, .05, z])
    posts.push([6.5, .05, z])
  }
  return <group>
    {posts.map((position, index) => <Part key={`post-${index}`} position={position} size={[.09, 1.15, .09]} color={dark} metalness={.4} roughness={.5} />)}
    {[-3.7, -2.4, -.8, .8, 2.4, 3.7].map(x => <Part key={`back-${x}`} position={[x, .05, -4.25]} size={[1.3, .045, .045]} color={dark} metalness={.42} roughness={.48} />)}
    {[-3.7, -2.4, 2.4, 3.7].map(x => <Part key={`front-${x}`} position={[x, .05, 4.25]} size={[1.3, .045, .045]} color={dark} metalness={.42} roughness={.48} />)}
    {[-3.7, -2.4, -.8, .8, 2.4, 3.7].map(z => <Part key={`left-${z}`} position={[-6.5, .05, z]} size={[.045, .045, 1.3]} color={dark} metalness={.42} roughness={.48} />)}
    {[-3.7, -2.4, -.8, .8, 2.4, 3.7].map(z => <Part key={`right-${z}`} position={[6.5, .05, z]} size={[.045, .045, 1.3]} color={dark} metalness={.42} roughness={.48} />)}
    <Part position={[0, .32, 4.25]} size={[2.1, .06, .07]} color="#8a765f" roughness={.6} />
    <Part position={[0, .82, 4.25]} size={[2.1, .06, .07]} color="#8a765f" roughness={.6} />
  </group>
}

function ExplodedBuilding({ active }: { active: boolean }) {
  const assembly = useRef<Group>(null)
  useFrame((state, delta) => {
    if (!active || !assembly.current) return
    assembly.current.rotation.y += delta * .075
    assembly.current.position.y = Math.sin(state.clock.elapsedTime * .55) * .035
  })
  return <group ref={assembly} rotation={[0, -.5, 0]}>
    <mesh position={[0, -.55, 0]} receiveShadow>
      <boxGeometry args={[14.5, .35, 10]} /><meshStandardMaterial color="#9ca58f" roughness={.98} />
    </mesh>
    <SiteFence />
    <Part position={[0, .13, 0]} size={[8.35, .3, 6.35]} color="#aaa9a1" roughness={.88} />
    <Part position={[-2, .32, -1.5]} size={[4, .035, 3]} color="#b59a76" />
    <Part position={[-2, .33, 1.5]} size={[4, .035, 3]} color="#a58b6d" />
    <Part position={[2, .32, -1.5]} size={[4, .035, 3]} color="#c9c4b8" />
    <Part position={[1, .33, 1.5]} size={[2, .035, 3]} color="#ae9678" />
    <Part position={[3, .33, 1.5]} size={[2, .035, 3]} color="#c2b8a6" />
    <Part position={[-1.3, 1.52, -3]} size={[5.4, 2.5, .24]} color="#e0ddd5" />
    <Part position={[1.35, 1.52, -3]} size={[5.3, 2.5, .24]} color="#e0ddd5" />
    <Part position={[-1.1, 1.52, 3]} size={[5.8, 2.5, .24]} color="#d8d5cc" />
    <Part position={[3.3, 1.52, 3]} size={[1.4, 2.5, .24]} color="#d8d5cc" />
    <Part position={[-4, 1.52, 0]} size={[.24, 2.5, 6]} color="#e3e0d8" />
    <Part position={[4, 1.52, -2]} size={[.24, 2.5, 2]} color="#dedbd2" />
    <Part position={[4, 1.52, 2]} size={[.24, 2.5, 2]} color="#dedbd2" />
    <Part position={[0, 1.52, -1.9]} size={[.2, 2.5, 2.2]} color="#d7d4cb" />
    <Part position={[0, 1.52, 2]} size={[.2, 2.5, 2]} color="#d7d4cb" />
    <Part position={[2.1, 1.52, 0]} size={[4.2, 2.5, .2]} color="#d7d4cb" />
    <Part position={[2.1, 1.52, 0]} size={[.2, 2.5, 6]} color="#d7d4cb" />
    <group position={[0, 4.15, 0]}>
      <Part position={[-2.2, .3, 0]} size={[4.8, .16, 6.7]} color="#606a70" roughness={.42} metalness={.22} />
      <Part position={[2.2, .3, 0]} size={[4.8, .16, 6.7]} color="#68737a" roughness={.42} metalness={.22} />
      <Part position={[0, .92, 0]} size={[.18, .14, 6.9]} color="#555f65" roughness={.42} metalness={.2} />
    </group>
    <WindowUnit />
    <DoorUnit />
    <group position={[0, -1.15, 4.15]} rotation={[-.08, 0, 0]}>
      <Part position={[0, 0, 0]} size={[8.3, .3, 6.25]} color="#a9aaa4" roughness={.85} />
      <Part position={[0, .16, 0]} size={[8.05, .035, 6]} color="#b8b9b2" roughness={.7} />
    </group>
  </group>
}

export default function ExplodedBuildingPreview({ active }: { active: boolean }) {
  const [reducedMotion, setReducedMotion] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return <Canvas className="customization-model-canvas" dpr={[1, 1.5]} camera={{ position: [14, 12, 16], fov: 36, near: .1, far: 100 }} shadows={{ type: PCFShadowMap }}>
    <color attach="background" args={['#eee9df']} />
    <ambientLight intensity={.72} />
    <hemisphereLight intensity={.7} color="#fffaf0" groundColor="#69736a" />
    <directionalLight position={[-8, 15, 9]} intensity={2.1} castShadow shadow-mapSize={[1024, 1024]} />
    <ExplodedBuilding active={active && !reducedMotion} />
  </Canvas>
}
