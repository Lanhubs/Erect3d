import { useMemo, useEffect, useState, useRef } from 'react'
import { DoubleSide } from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import type { ArchitectureVision } from '../domain/architectureTypes'
import type { RoofSection } from '../domain/types'
import { canopyGeometry, canopyParameters } from '../geometry/arenaCanopy'
import { arenaCanopyBuffers, type CanopyBuffers } from '../geometry/arenaCanopyBuffers'
import { useGraphicsSettings } from './GraphicsRuntime'
import { roofTexture } from './roofTextures'
import { ArenaSkylights } from './ArenaSkylights'
export function ArenaCanopy({ vision, section }: { vision: ArchitectureVision; section: RoofSection }) {
  const top = section.topHeight || vision.brief.clearance
  const { tier } = useGraphicsSettings(),
    { camera, size, invalidate } = useThree(),
    [distanceTier, setDistanceTier] = useState(1),
    timer = useRef(0)
  useFrame((_, delta) => {
    timer.current += delta
    if (timer.current < 2) return
    timer.current = 0
    const distance = Math.max(
      1,
      Math.hypot(
        camera.position.x - vision.center.x,
        camera.position.z - vision.center.z,
        camera.position.y - top,
      ),
    )
    const pixels = (Math.max(vision.radiusX, vision.radiusZ) * size.height) / distance
    if (pixels < 170 && distanceTier !== 0) setDistanceTier(0)
    else if (pixels > 230 && distanceTier !== 1) setDistanceTier(1)
  })
  const segments = distanceTier === 0 ? 48 : tier === 'high' ? 144 : tier === 'performance' ? 64 : 96
  const parameters = useMemo(
    () => canopyParameters(vision, top, segments, tier === 'high' ? 36 : 24),
    [
      vision.radiusX,
      vision.radiusZ,
      vision.center.x,
      vision.center.z,
      vision.rotation,
      vision.brief.roofRise,
      vision.brief.roofCoverage,
      top,
      segments,
      tier,
    ],
  )
  const [geometry, setGeometry] = useState(() =>
    canopyGeometry(arenaCanopyBuffers({ ...parameters, segments: 32, rows: 12 })),
  )
  useEffect(() => {
    if (typeof Worker === 'undefined') {
      setGeometry(canopyGeometry(arenaCanopyBuffers(parameters)))
      return
    }
    const worker = new Worker(new URL('../workers/canopyGeometry.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<CanopyBuffers>) => {
      setGeometry(canopyGeometry(event.data))
      invalidate()
      worker.terminate()
    }
    worker.onerror = () => {
      setGeometry(canopyGeometry(arenaCanopyBuffers(parameters)))
      invalidate()
      worker.terminate()
    }
    worker.postMessage(parameters)
    return () => worker.terminate()
  }, [parameters, invalidate])
  const texture = useMemo(() => {
    const map = roofTexture(section.roof.material).clone()
    map.repeat.set(vision.radiusX, vision.radiusZ)
    return map
  }, [section.roof.material, vision.radiusX, vision.radiusZ])
  useEffect(() => () => texture.dispose(), [texture])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <group name="editable-arena-daylight-canopy">
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial
          attach="material-0"
          map={texture}
          color={section.roof.color}
          metalness={0.55}
          roughness={0.38}
          side={DoubleSide}
        />
        <meshPhysicalMaterial
          attach="material-1"
          color="#adcbd3"
          metalness={0.05}
          roughness={0.08}
          transmission={tier === 'high' ? 0.65 : tier === 'balanced' ? 0.2 : 0}
          transparent
          opacity={0.8}
          side={DoubleSide}
        />
        <meshStandardMaterial
          attach="material-2"
          color="#647078"
          metalness={0.4}
          roughness={0.5}
          side={DoubleSide}
        />
        <meshStandardMaterial
          attach="material-3"
          color="#c1c7c8"
          metalness={0.15}
          roughness={0.7}
          side={DoubleSide}
        />
      </mesh>
      <ArenaSkylights parameters={parameters} />
    </group>
  )
}
