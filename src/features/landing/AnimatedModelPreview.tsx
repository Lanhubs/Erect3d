import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import type { Group } from 'three'

function Room({ position, size, color }: { position: [number, number, number]; size: [number, number]; color: string }) {
  return <mesh position={position} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
    <planeGeometry args={size} /><meshStandardMaterial color={color} roughness={.92} />
  </mesh>
}

function Wall({ position, size, color = '#dedbd2' }: { position: [number, number, number]; size: [number, number, number]; color?: string }) {
  return <mesh position={position} castShadow receiveShadow>
    <boxGeometry args={size} /><meshStandardMaterial color={color} roughness={.84} />
  </mesh>
}

function CutawayHouse({ active }: { active: boolean }) {
  const model = useRef<Group>(null)
  useFrame((state, delta) => {
    if (!active || !model.current) return
    model.current.rotation.y += delta * .12
    model.current.position.y = Math.sin(state.clock.elapsedTime * .7) * .035
  })
  return <group ref={model} rotation={[0, -.42, 0]}>
    <group position={[-6, 0, -4]}>
      <mesh position={[6, -.22, 4]} castShadow receiveShadow>
        <boxGeometry args={[12.25, .44, 8.25]} /><meshStandardMaterial color="#8d918a" roughness={.82} />
      </mesh>
      <Room position={[2.5, .012, 2]} size={[5, 4]} color="#bba88b" />
      <Room position={[2.5, .014, 6]} size={[5, 4]} color="#a38a68" />
      <Room position={[8.5, .012, 2]} size={[7, 4]} color="#c6c0b2" />
      <Room position={[6.75, .014, 6]} size={[3.5, 4]} color="#ad987c" />
      <Room position={[10.25, .014, 6]} size={[3.5, 4]} color="#c4b9a6" />
      <Wall position={[1.05, 1.48, 0]} size={[2.1, 2.9, .28]} />
      <Wall position={[8, 1.48, 0]} size={[8, 2.9, .28]} />
      <Wall position={[0, 1.48, 1.95]} size={[.28, 2.9, 3.9]} />
      <Wall position={[0, 1.48, 7]} size={[.28, 2.9, 2]} />
      <Wall position={[12, 1.48, .55]} size={[.28, 2.9, 1.1]} />
      <Wall position={[12, 1.48, 5.45]} size={[.28, 2.9, 5.1]} />
      <Wall position={[4.4, 1.48, 8]} size={[8.8, 2.9, .28]} />
      <Wall position={[10.95, 1.48, 8]} size={[2.1, 2.9, .28]} />
      <Wall position={[5, 1.48, 1.2]} size={[.22, 2.9, 2.4]} />
      <Wall position={[5, 1.48, 5.65]} size={[.22, 2.9, 4.7]} />
      <Wall position={[5.75, 1.48, 4]} size={[1.5, 2.9, .2]} />
      <Wall position={[9.675, 1.48, 4]} size={[4.65, 2.9, .2]} />
      <Wall position={[8.5, 1.48, 6]} size={[.2, 2.9, 4]} />
      <Wall position={[12, .82, 2]} size={[.08, 1.25, 1.7]} color="#6e9298" />
      <Wall position={[0, .82, 4.95]} size={[.08, 1.25, 2.1]} color="#6e9298" />
      <Wall position={[9.35, .02, 8]} size={[1.1, .035, .32]} color="#806347" />
      <mesh position={[2.5, .08, 2.1]} castShadow>
        <boxGeometry args={[1.35, .14, .62]} /><meshStandardMaterial color="#8d725b" roughness={.86} />
      </mesh>
      <mesh position={[9.5, .06, 1.15]} castShadow>
        <boxGeometry args={[1.6, .1, .7]} /><meshStandardMaterial color="#888d81" roughness={.88} />
      </mesh>
    </group>
  </group>
}

export default function AnimatedModelPreview({ active }: { active: boolean }) {
  const [reducedMotion, setReducedMotion] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return <Canvas className="comparison-model-canvas" dpr={[1, 1.5]} camera={{ position: [15, 12, 17], fov: 35, near: .1, far: 100 }}>
    <color attach="background" args={['#e9ece7']} />
    <ambientLight intensity={.7} />
    <hemisphereLight intensity={.75} color="#fffaf0" groundColor="#657169" />
    <directionalLight position={[-8, 15, 9]} intensity={2.1} />
    <CutawayHouse active={active && !reducedMotion} />
  </Canvas>
}
