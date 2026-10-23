import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { BoxGeometry, MeshStandardMaterial, type Group } from 'three'
import { sectionalPanelPose } from '../geometry/sectionalDoor'
import { useRenderResources } from './RenderResources'
export function SectionalDoor({
  width,
  height,
  open,
  selected,
  metal = true,
}: {
  width: number
  height: number
  open: boolean
  selected: boolean
  metal?: boolean
}) {
  const resources = useRenderResources()
  const count = Math.max(3, Math.min(12, Math.ceil(height / 0.45))),
    panelHeight = (height - 0.08) / count
  const refs = useRef<(Group | null)[]>([]),
    progress = useRef(0),
    invalidate = useThree((s) => s.invalidate)
  const geometry = useMemo(
    () => new BoxGeometry(Math.max(0.08, width - 0.14), panelHeight - 0.012, 0.045),
    [width, panelHeight],
  )
  const material = useMemo(
    () => new MeshStandardMaterial({ color: '#bcc2bf', metalness: 0.35, roughness: 0.45 }),
    [],
  )
  useEffect(() => {
    material.color.set(selected ? '#c9964f' : metal ? '#bcc2bf' : '#8c7053')
    material.metalness = metal ? 0.35 : 0
    material.roughness = metal ? 0.45 : 0.65
    invalidate()
  }, [selected, metal, material, invalidate])
  useEffect(
    () => () => {
      geometry.dispose()
    },
    [geometry],
  )
  useEffect(() => () => material.dispose(), [material])
  useFrame((_, delta) => {
    const target = open ? 1 : 0
    if (Math.abs(target - progress.current) > 0.00001) resources.shadowEpoch++
    progress.current += (target - progress.current) * Math.min(1, delta * 7)
    refs.current.forEach((group, i) => {
      if (!group) return
      const pose = sectionalPanelPose(height, (i + 0.5) * panelHeight + 0.025, progress.current)
      group.position.set(0, pose.y, pose.z)
      group.rotation.x = pose.rotation
    })
    if (Math.abs(target - progress.current) > 0.001) invalidate()
  }, -1)
  return (
    <group name="sectional-garage-door">
      {Array.from({ length: count }, (_, i) => (
        <group
          key={i}
          ref={(node) => {
            refs.current[i] = node
          }}
          position={[0, (i + 0.5) * panelHeight + 0.025, 0]}
        >
          {/* Thin moving leaves cast the silhouette; receiving their own coarse shadow map caused diagonal surface acne. */}
          <mesh geometry={geometry} material={material} dispose={null} castShadow />
          {[-1, 1].flatMap((face) =>
            [-1, 1].map((side) => (
              <mesh key={`${face}:${side}`} position={[side * width * 0.24, 0, face * 0.028]}>
                <boxGeometry args={[Math.max(0.05, width * 0.44), panelHeight * 0.62, 0.008]} />
                <meshStandardMaterial
                  color={selected ? '#d9b06e' : metal ? '#d2d6d0' : '#a28362'}
                  metalness={metal ? 0.22 : 0}
                  roughness={0.5}
                />
              </mesh>
            )),
          )}
        </group>
      ))}
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[(side * (width + 0.04)) / 2, height / 2, -0.09]}>
            <boxGeometry args={[0.035, height, 0.035]} />
            <meshStandardMaterial color="#768184" metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position={[(side * (width + 0.04)) / 2, height, -height * 0.55]}>
            <boxGeometry args={[0.035, 0.035, height * 1.1]} />
            <meshStandardMaterial color="#768184" metalness={0.8} roughness={0.3} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
