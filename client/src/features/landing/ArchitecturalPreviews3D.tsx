import { useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Vector3, type Group } from 'three'

export type ArchitecturalPreviewMode = 'plan' | 'model' | 'walk' | 'section'

function Box({ position, size, color, roughness = .84, metalness = 0 }: {
  position: [number, number, number]; size: [number, number, number]; color: string; roughness?: number; metalness?: number
}) {
  return <mesh position={position} castShadow receiveShadow>
    <boxGeometry args={size} /><meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />
  </mesh>
}

function RoomFloor({ position, size, color }: { position: [number, number, number]; size: [number, number]; color: string }) {
  return <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
    <planeGeometry args={size} /><meshStandardMaterial color={color} roughness={.88} />
  </mesh>
}

function Building({ mode }: { mode: ArchitecturalPreviewMode }) {
  const model = useRef<Group>(null)
  useFrame((state, delta) => {
    if (mode !== 'model' || !model.current) return
    model.current.rotation.y += delta * .075
    model.current.position.y = Math.sin(state.clock.elapsedTime * .55) * .025
  })
  return <group ref={model}>
    <Box position={[0, -.16, 0]} size={[8.4, .32, 6.4]} color="#969b94" />
    <RoomFloor position={[-2, .012, -1.5]} size={[4, 3]} color="#bda989" />
    <RoomFloor position={[-2, .014, 1.5]} size={[4, 3]} color="#a98f6e" />
    <RoomFloor position={[2, .012, -1.5]} size={[4, 3]} color="#d0cabe" />
    <RoomFloor position={[1, .014, 1.5]} size={[2, 3]} color="#b29a7c" />
    <RoomFloor position={[3, .014, 1.5]} size={[2, 3]} color="#c7bcaa" />
    <Box position={[-1.3, 1.42, -3]} size={[5.4, 2.8, .24]} color="#dedbd3" />
    <Box position={[1.35, 1.42, -3]} size={[5.3, 2.8, .24]} color="#dedbd3" />
    {!['section'].includes(mode) && <>
      <Box position={[-1.2, 1.42, 3]} size={[5.6, 2.8, .24]} color="#d9d6cd" />
      <Box position={[3.3, 1.42, 3]} size={[1.4, 2.8, .24]} color="#d9d6cd" />
    </>}
    <Box position={[-4, 1.42, 0]} size={[.24, 2.8, 6]} color="#e3e0d8" />
    <Box position={[4, 1.42, -2]} size={[.24, 2.8, 2]} color="#dedbd2" />
    <Box position={[4, 1.42, 2]} size={[.24, 2.8, 2]} color="#dedbd2" />
    <Box position={[0, 1.42, -1.9]} size={[.2, 2.8, 2.2]} color="#d7d4cb" />
    <Box position={[0, 1.42, 2]} size={[.2, 2.8, 2]} color="#d7d4cb" />
    <Box position={[2.1, 1.42, 0]} size={[4.2, 2.8, .2]} color="#d7d4cb" />
    <Box position={[2.1, 1.42, 0]} size={[.2, 2.8, 6]} color="#d7d4cb" />
    <Box position={[4, 1.55, .25]} size={[.08, 1.25, 1.5]} color="#78a1a7" roughness={.24} metalness={.16} />
    <Box position={[-.2, .8, -3]} size={[1.15, 1.4, .07]} color="#78a1a7" roughness={.24} metalness={.16} />
    <Box position={[2.8, 1.2, 3]} size={[.85, 2.35, .1]} color="#806749" roughness={.67} />
    <Box position={[2.8, 2.45, 3]} size={[1.04, .09, .18]} color="#594f43" />
    <Box position={[2.3, 1.2, 3]} size={[.08, 2.5, .16]} color="#594f43" />
    <Box position={[3.3, 1.2, 3]} size={[.08, 2.5, .16]} color="#594f43" />
    {mode === 'model' && <group position={[0, 3.65, 0]}>
      <Box position={[-2.15, .16, 0]} size={[4.7, .16, 6.65]} color="#5e6970" roughness={.42} metalness={.18} />
      <Box position={[2.15, .16, 0]} size={[4.7, .16, 6.65]} color="#68747a" roughness={.42} metalness={.18} />
      <Box position={[0, .82, 0]} size={[.16, .14, 6.8]} color="#555f65" roughness={.46} metalness={.16} />
    </group>}
  </group>
}

function CameraMotion({ mode }: { mode: ArchitecturalPreviewMode }) {
  const { camera } = useThree()
  const target = useRef(new Vector3())
  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime
    const position = mode === 'plan' ? new Vector3(0, 17, .001)
      : mode === 'walk' ? new Vector3(Math.sin(t * .2) * .18, 1.62 + Math.sin(t * .45) * .025, 2.55 + Math.sin(t * .16) * .22)
      : mode === 'section' ? new Vector3(10, 7, 11)
      : new Vector3(10, 8, 12)
    const look = mode === 'walk' ? new Vector3(0, 1.55, -3.5) : new Vector3(0, 1, 0)
    camera.up.set(0, mode === 'plan' ? 0 : 1, mode === 'plan' ? -1 : 0)
    camera.position.lerp(position, 1 - Math.exp(-delta * 2.6))
    target.current.lerp(look, 1 - Math.exp(-delta * 2.6))
    camera.lookAt(target.current)
  })
  return null
}

export default function ArchitecturalPreviews3D({ mode, active }: { mode: ArchitecturalPreviewMode; active: boolean }) {
  return <Canvas className="architectural-preview-canvas" frameloop={active ? 'always' : 'demand'} dpr={[1, 1.5]}
    camera={{ position: [10, 8, 12], fov: 42, near: .1, far: 100 }}>
    <color attach="background" args={[mode === 'walk' ? '#e7e8e1' : '#e9ece7']} />
    <ambientLight intensity={.68} />
    <hemisphereLight intensity={.72} color="#fffaf0" groundColor="#657169" />
    <directionalLight position={[-8, 15, 9]} intensity={2} />
    <CameraMotion mode={mode} />
    {mode !== 'walk' && <Building mode={mode} />}
    {active && mode === 'walk' && <Interior />}
  </Canvas>
}

function Interior() {
  const { camera } = useThree()
  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime
    const position = new Vector3(Math.sin(t * .2) * .18, 1.62 + Math.sin(t * .45) * .025, 2.55 + Math.sin(t * .16) * .22)
    camera.position.lerp(position, 1 - Math.exp(-delta * 2.6))
    camera.lookAt(0, 1.55, -3.5)
  })
  return <group>
    <RoomFloor position={[0, -.02, 0]} size={[8, 8]} color="#a88d6e" />
    <Box position={[0, 1.55, -4]} size={[8, 3.1, .22]} color="#dedbd2" />
    <Box position={[-4, 1.55, 0]} size={[.22, 3.1, 8]} color="#e5e2da" />
    <Box position={[4, 1.55, 0]} size={[.22, 3.1, 8]} color="#d9d6cd" />
    <Box position={[-2.25, 2, -3.86]} size={[2.1, 1.45, .06]} color="#88adb1" roughness={.2} metalness={.16} />
    <Box position={[-2.25, 2, -3.8]} size={[2.28, .1, .14]} color="#59645f" metalness={.3} />
    <Box position={[-3.35, 2, -3.8]} size={[.1, 1.55, .14]} color="#59645f" metalness={.3} />
    <Box position={[-1.15, 2, -3.8]} size={[.1, 1.55, .14]} color="#59645f" metalness={.3} />
    <Box position={[2.5, 1.4, -3.86]} size={[1.2, 2.8, .08]} color="#806749" roughness={.66} />
    <Box position={[0, .42, -1.5]} size={[2.5, .65, 1.1]} color="#8b735c" />
    <Box position={[-1.25, .34, -1.5]} size={[.18, .65, 1.12]} color="#655748" />
    <Box position={[1.25, .34, -1.5]} size={[.18, .65, 1.12]} color="#655748" />
    <Box position={[2.65, .42, 1.1]} size={[.75, .84, .75]} color="#c5b9a6" />
    <Box position={[0, 3.15, 0]} size={[8, .18, 8]} color="#eeece6" />
  </group>
}
