import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { PCFShadowMap, type Group } from 'three'

function Part({
  position,
  size,
  color,
  roughness = 0.8,
  metalness = 0,
}: {
  position: [number, number, number]
  size: [number, number, number]
  color: string
  roughness?: number
  metalness?: number
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />
    </mesh>
  )
}

function WindowUnit() {
  return (
    <group position={[5.25, 2.1, 0.25]} rotation={[0, Math.PI / 2, 0]}>
      <Part position={[-0.62, 0, 0]} size={[0.09, 1.3, 0.13]} color="#56615d" metalness={0.4} />
      <Part position={[0.62, 0, 0]} size={[0.09, 1.3, 0.13]} color="#56615d" metalness={0.4} />
      <Part position={[0, 0.61, 0]} size={[1.3, 0.09, 0.13]} color="#56615d" metalness={0.4} />
      <Part position={[0, -0.61, 0]} size={[1.3, 0.09, 0.13]} color="#56615d" metalness={0.4} />
      <Part
        position={[0, 0, -0.025]}
        size={[1.12, 1.1, 0.035]}
        color="#83a9ae"
        roughness={0.22}
        metalness={0.18}
      />
      <Part position={[0, 0, 0.06]} size={[0.035, 1.1, 0.055]} color="#56615d" metalness={0.4} />
    </group>
  )
}

function DoorUnit() {
  return (
    <group position={[5, 1.45, 4.1]}>
      <Part position={[-0.58, 1.42, 0]} size={[0.12, 2.84, 0.16]} color="#5b5145" />
      <Part position={[0.58, 1.42, 0]} size={[0.12, 2.84, 0.16]} color="#5b5145" />
      <Part position={[0, 2.78, 0]} size={[1.28, 0.12, 0.16]} color="#5b5145" />
      <Part position={[0, 1.4, 0.02]} size={[1, 2.65, 0.12]} color="#866c4f" roughness={0.66} />
      <Part
        position={[0.34, 1.4, 0.1]}
        size={[0.045, 0.045, 0.06]}
        color="#d4bd8f"
        metalness={0.62}
        roughness={0.32}
      />
    </group>
  )
}

function SiteFence() {
  const dark = '#596863'
  const posts: [number, number, number][] = []
  for (let x = -6.5; x <= 6.51; x += 1.3) {
    posts.push([x, 0.05, -4.25])
    if (Math.abs(x) > 1.6) posts.push([x, 0.05, 4.25])
  }
  for (let z = -3.25; z <= 3.26; z += 1.3) {
    posts.push([-6.5, 0.05, z])
    posts.push([6.5, 0.05, z])
  }
  return (
    <group>
      {posts.map((position, index) => (
        <Part
          key={`post-${index}`}
          position={position}
          size={[0.09, 1.15, 0.09]}
          color={dark}
          metalness={0.4}
          roughness={0.5}
        />
      ))}
      {[-3.7, -2.4, -0.8, 0.8, 2.4, 3.7].map((x) => (
        <Part
          key={`back-${x}`}
          position={[x, 0.05, -4.25]}
          size={[1.3, 0.045, 0.045]}
          color={dark}
          metalness={0.42}
          roughness={0.48}
        />
      ))}
      {[-3.7, -2.4, 2.4, 3.7].map((x) => (
        <Part
          key={`front-${x}`}
          position={[x, 0.05, 4.25]}
          size={[1.3, 0.045, 0.045]}
          color={dark}
          metalness={0.42}
          roughness={0.48}
        />
      ))}
      {[-3.7, -2.4, -0.8, 0.8, 2.4, 3.7].map((z) => (
        <Part
          key={`left-${z}`}
          position={[-6.5, 0.05, z]}
          size={[0.045, 0.045, 1.3]}
          color={dark}
          metalness={0.42}
          roughness={0.48}
        />
      ))}
      {[-3.7, -2.4, -0.8, 0.8, 2.4, 3.7].map((z) => (
        <Part
          key={`right-${z}`}
          position={[6.5, 0.05, z]}
          size={[0.045, 0.045, 1.3]}
          color={dark}
          metalness={0.42}
          roughness={0.48}
        />
      ))}
      <Part position={[0, 0.32, 4.25]} size={[2.1, 0.06, 0.07]} color="#8a765f" roughness={0.6} />
      <Part position={[0, 0.82, 4.25]} size={[2.1, 0.06, 0.07]} color="#8a765f" roughness={0.6} />
    </group>
  )
}

function ExplodedBuilding({ active }: { active: boolean }) {
  const assembly = useRef<Group>(null)
  useFrame((state, delta) => {
    if (!active || !assembly.current) return
    assembly.current.rotation.y += delta * 0.075
    assembly.current.position.y = Math.sin(state.clock.elapsedTime * 0.55) * 0.035
  })
  return (
    <group ref={assembly} rotation={[0, -0.5, 0]}>
      <mesh position={[0, -0.55, 0]} receiveShadow>
        <boxGeometry args={[14.5, 0.35, 10]} />
        <meshStandardMaterial color="#9ca58f" roughness={0.98} />
      </mesh>
      <SiteFence />
      <Part position={[0, 0.13, 0]} size={[8.35, 0.3, 6.35]} color="#aaa9a1" roughness={0.88} />
      <Part position={[-2, 0.32, -1.5]} size={[4, 0.035, 3]} color="#b59a76" />
      <Part position={[-2, 0.33, 1.5]} size={[4, 0.035, 3]} color="#a58b6d" />
      <Part position={[2, 0.32, -1.5]} size={[4, 0.035, 3]} color="#c9c4b8" />
      <Part position={[1, 0.33, 1.5]} size={[2, 0.035, 3]} color="#ae9678" />
      <Part position={[3, 0.33, 1.5]} size={[2, 0.035, 3]} color="#c2b8a6" />
      <Part position={[-1.3, 1.52, -3]} size={[5.4, 2.5, 0.24]} color="#e0ddd5" />
      <Part position={[1.35, 1.52, -3]} size={[5.3, 2.5, 0.24]} color="#e0ddd5" />
      <Part position={[-1.1, 1.52, 3]} size={[5.8, 2.5, 0.24]} color="#d8d5cc" />
      <Part position={[3.3, 1.52, 3]} size={[1.4, 2.5, 0.24]} color="#d8d5cc" />
      <Part position={[-4, 1.52, 0]} size={[0.24, 2.5, 6]} color="#e3e0d8" />
      <Part position={[4, 1.52, -2]} size={[0.24, 2.5, 2]} color="#dedbd2" />
      <Part position={[4, 1.52, 2]} size={[0.24, 2.5, 2]} color="#dedbd2" />
      <Part position={[0, 1.52, -1.9]} size={[0.2, 2.5, 2.2]} color="#d7d4cb" />
      <Part position={[0, 1.52, 2]} size={[0.2, 2.5, 2]} color="#d7d4cb" />
      <Part position={[2.1, 1.52, 0]} size={[4.2, 2.5, 0.2]} color="#d7d4cb" />
      <Part position={[2.1, 1.52, 0]} size={[0.2, 2.5, 6]} color="#d7d4cb" />
      <group position={[0, 4.15, 0]}>
        <Part
          position={[-2.2, 0.3, 0]}
          size={[4.8, 0.16, 6.7]}
          color="#606a70"
          roughness={0.42}
          metalness={0.22}
        />
        <Part
          position={[2.2, 0.3, 0]}
          size={[4.8, 0.16, 6.7]}
          color="#68737a"
          roughness={0.42}
          metalness={0.22}
        />
        <Part
          position={[0, 0.92, 0]}
          size={[0.18, 0.14, 6.9]}
          color="#555f65"
          roughness={0.42}
          metalness={0.2}
        />
      </group>
      <WindowUnit />
      <DoorUnit />
      <group position={[0, -1.15, 4.15]} rotation={[-0.08, 0, 0]}>
        <Part position={[0, 0, 0]} size={[8.3, 0.3, 6.25]} color="#a9aaa4" roughness={0.85} />
        <Part position={[0, 0.16, 0]} size={[8.05, 0.035, 6]} color="#b8b9b2" roughness={0.7} />
      </group>
    </group>
  )
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
  return (
    <Canvas
      className="customization-model-canvas"
      dpr={[1, 1.5]}
      camera={{ position: [14, 12, 16], fov: 36, near: 0.1, far: 100 }}
      shadows={{ type: PCFShadowMap }}
    >
      <color attach="background" args={['#eee9df']} />
      <ambientLight intensity={0.72} />
      <hemisphereLight intensity={0.7} color="#fffaf0" groundColor="#69736a" />
      <directionalLight position={[-8, 15, 9]} intensity={2.1} castShadow shadow-mapSize={[1024, 1024]} />
      <ExplodedBuilding active={active && !reducedMotion} />
    </Canvas>
  )
}
