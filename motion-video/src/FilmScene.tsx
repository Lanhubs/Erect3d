import { DraftPlan } from './DraftPlan'
import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  ACESFilmicToneMapping,
  Color,
  Group,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  Vector3,
  type Mesh,
} from 'three'
import { RenderResourceScope } from '../../client/src/rendering/RenderResources'
import { SharedStandardMaterial } from '../../client/src/rendering/SharedStandardMaterial'
import { RoomSurface } from '../../client/src/rendering/RoomSurface'
import { SlabMesh } from '../../client/src/rendering/SlabMesh'
import { WindowMesh } from '../../client/src/rendering/WindowMesh'
import { DoorMesh } from '../../client/src/rendering/DoorMesh'
import { StairMesh } from '../../client/src/rendering/StairMesh'
import { ArchitecturalDetailMesh } from '../../client/src/rendering/ArchitecturalDetailMesh'
import { VerandaMesh } from '../../client/src/rendering/VerandaMesh'
import { BuildingRoofs } from '../../client/src/rendering/BuildingRoofs'
import { FurnitureMeshes } from '../../client/src/furniture/FurnitureMeshes'
import { prepareEnvironment } from '../../client/src/rendering/CachedEnvironment'
import { wallSolids, wallRects } from '../../client/src/geometry/walls'
import { wallTexture } from '../../client/src/rendering/wallTextures'
import { building, selectedWindow, windowVariants } from './model'
import { cameraAt, editStep, progress, type FilmTimeline } from './timeline'
import type { Level, Wall, WindowUnit } from '../../client/src/domain/types'
const noop = () => {},
  offset = () => 0
function Wall({ wall, level, windows }: { wall: Wall; level: Level; windows: WindowUnit[] }) {
  const rects = useMemo(
    () => wallSolids(wall, level.doors, windows, level.passages).flatMap((s) => wallRects(wall, s)),
    [wall, level, windows],
  )
  return (
    <>
      {rects.map((r, i) => (
        <mesh key={i} position={r.center} rotation={[0, r.rotation, 0]} castShadow receiveShadow>
          <boxGeometry args={r.size} />
          <SharedStandardMaterial
            color={wall.color || '#ddd7cb'}
            roughness={0.85}
            map={wallTexture(wall.material, r.size[0], r.size[1])}
          />
        </mesh>
      ))}
    </>
  )
}
const LevelParts = memo(function LevelParts({ level, index }: { level: Level; index: number }) {
  const parts = useRef<Group>(null),
    slabs = useRef<Group>(null),
    walls = useRef<Group>(null),
    details = useRef<Group>(null),
    objects = useRef<Group>(null),
    variants = useRef<Group>(null)

  useLayoutEffect(() => {
    if (parts.current)
      parts.current.userData = {
        filmLevel: index,
        slabs: slabs.current,
        walls: walls.current,
        details: details.current,
        objects: objects.current,
        variants: variants.current,
      }
  }, [index])
  const selectedHost = index === 0 ? level.walls.find((w) => w.id === selectedWindow.wallId) : undefined
  const windowSets = useMemo(
    () =>
      windowVariants.map((variant) => level.windows.map((w) => (w.id === selectedWindow.id ? variant : w))),
    [level],
  )

  return (
    <group ref={parts} name={`film-level-${index}`} position={[0, level.elevation, 0]}>
      <group ref={slabs}>
        {level.slabs?.map((s) => (
          <SlabMesh key={s.id} slab={s} selection={null} select={noop} />
        ))}
        {level.rooms.map((r) => (
          <RoomSurface
            key={r.id}
            room={r}
            openings={level.slabs?.flatMap((s) => s.openings.map((o) => o.polygon))}
          />
        ))}
      </group>
      <group ref={walls}>
        {level.walls
          .filter((w) => w.id !== selectedHost?.id)
          .map((w) => (
            <Wall key={w.id} wall={w} level={level} windows={level.windows} />
          ))}
        {selectedHost && (
          <group ref={variants}>
            {windowSets.map((windows, i) => (
              <group key={i}>
                <Wall wall={selectedHost} level={level} windows={windows} />
                {windows
                  .filter((w) => w.wallId === selectedHost.id)
                  .map((w) => (
                    <WindowMesh key={w.id} wall={selectedHost} window={w} selection={null} select={noop} />
                  ))}
              </group>
            ))}
          </group>
        )}
        {level.windows
          .filter((w) => w.wallId !== selectedHost?.id)
          .map((w) => (
            <WindowMesh
              key={w.id}
              window={w}
              wall={level.walls.find((h) => h.id === w.wallId)!}
              selection={null}
              select={noop}
            />
          ))}
        {level.doors.map((d) => (
          <DoorMesh
            key={d.id}
            door={d}
            wall={level.walls.find((w) => w.id === d.wallId)!}
            selection={null}
            select={noop}
            open
            pose={1}
          />
        ))}
      </group>
      <group ref={details}>
        {level.doors
          .filter((d) => d.veranda)
          .map((d) => (
            <VerandaMesh
              key={d.id}
              level={level}
              door={d}
              roof={building.roof}
              roofShown
              selection={null}
              select={noop}
            />
          ))}
        {level.stairs?.map((s) => (
          <StairMesh key={s.id} stair={s} levels={building.levels} selection={null} select={noop} />
        ))}
        {level.details?.map((d) => (
          <ArchitecturalDetailMesh key={d.id} detail={d} selection={null} select={noop} />
        ))}
      </group>
      <group ref={objects}>
        <FurnitureMeshes level={level} selection={null} select={noop} />
      </group>
    </group>
  )
})
function Scene({ timeline, onReady }: { timeline: FilmTimeline; onReady: () => void }) {
  const { gl, scene, camera, invalidate } = useThree(),
    roof = useRef<Group>(null),
    plan = useRef<Group>(null),
    selection = useRef<Mesh>(null),
    root = useRef<Group>(null)
  useEffect(() => timeline.subscribe(invalidate), [timeline, invalidate])
  const neutral = useMemo(() => new Color('#ded8ca'), []),
    materials = useRef<{ m: MeshStandardMaterial; c: Color }[]>([])
  useEffect(() => {
    let alive = true,
      dispose: (() => void) | undefined
    prepareEnvironment(gl, scene, 'high')
      .then((cleanup) => {
        if (!alive) {
          cleanup()
          return
        }
        dispose = cleanup
        scene.traverse((o) => {
          const material = (o as Mesh).material
          if (!material) return
          for (const m of Array.isArray(material) ? material : [material])
            if (m instanceof MeshStandardMaterial && !materials.current.some((x) => x.m === m))
              materials.current.push({ m, c: m.color.clone() })
        })
        const visibility: { object: import('three').Object3D; visible: boolean }[] = []
        scene.traverse((object) => {
          visibility.push({ object, visible: object.visible })
          object.visible = true
        })
        try {
          gl.compile(scene, camera)
        } finally {
          visibility.forEach((v) => (v.object.visible = v.visible))
        }
        invalidate()
        onReady()
      })
      .catch((error) => {
        document.querySelector('.film-root')?.setAttribute('data-error', String(error))
      })
    return () => {
      alive = false
      dispose?.()
    }
  }, [gl, scene, camera, onReady])
  useFrame(() => {
    if (gl.domElement.width !== 1920 || gl.domElement.height !== 1080) gl.setSize(1920, 1080, false)
    const t = timeline.time,
      c = cameraAt(t)
    camera.position.set(...c.position)
    camera.lookAt(new Vector3(...c.target))
    if ('fov' in camera) {
      camera.fov = c.fov
      ;(camera as import('three').PerspectiveCamera).updateProjectionMatrix()
    }
    root.current?.children.forEach((level, i) => {
      const d = level.userData,
        base = i ? 15.4 : 12.4
      if (d.slabs) {
        d.slabs.scale.y = Math.max(0.001, progress(t, base, base + 0.7))
        d.slabs.visible = t > base
        d.walls.scale.y = Math.max(0.001, progress(t, base + 0.2, base + 2))
        d.walls.visible = t > base + 0.2
        d.details.scale.y = Math.max(0.001, progress(t, base + 1.3, base + 2.6))
        d.details.visible = t > base + 1.3
        d.objects.scale.y = Math.max(0.001, progress(t, base + 2, base + 2.8))
        d.objects.visible = t > base + 2
        d.variants?.children.forEach((v: Group, n: number) => (v.visible = n === editStep(t)))
      }
    })
    if (selection.current) {
      const width = windowVariants[editStep(t)].width
      selection.current.visible = t >= 24.3 && t < 27.8
      selection.current.scale.x = width + 0.12
      selection.current.position.x = 12 - selectedWindow.offset - width / 2
    }
    if (roof.current) {
      roof.current.visible = t > 18
      roof.current.scale.y = Math.max(0.001, progress(t, 18, 19))
      roof.current.position.y = 6.2 * (1 - roof.current.scale.y)
    }
    if (plan.current) plan.current.visible = t < 17.8
    const finish = progress(t, 18.5, 20)
    materials.current.forEach(({ m, c }) => {
      m.color.copy(neutral).lerp(c, finish)
    })
    gl.shadowMap.needsUpdate = true
    gl.render(scene, camera)
    gl.domElement.dataset.renderedTime = t.toFixed(6)
  }, 1)
  return (
    <>
      <color attach="background" args={['#f3f0ea']} />
      <ambientLight intensity={0.65} />
      <hemisphereLight args={['#f5f4ed', '#b4a992', 1.4]} />
      <directionalLight
        position={[-8, 20, 15]}
        intensity={3}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        shadow-normalBias={0.035}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[6, -0.26, 5]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#e5dfd2" roughness={1} />
      </mesh>
      <group ref={plan}>
        <DraftPlan />
      </group>
      <group ref={root}>
        {building.levels.map((l, i) => (
          <LevelParts key={l.id} level={l} index={i} />
        ))}
      </group>
      <mesh ref={selection} position={[2.7, 1.45, 10]}>
        <boxGeometry args={[1, 1.65, 0.3]} />
        <meshBasicMaterial color="#b17b43" wireframe />
      </mesh>
      <group ref={roof}>
        <BuildingRoofs building={building} shown={building.levels} offset={offset} />
      </group>
    </>
  )
}
export function FilmScene({ timeline, onReady }: { timeline: FilmTimeline; onReady: () => void }) {
  return (
    <Canvas
      frameloop="demand"
      dpr={1}
      shadows
      camera={{ position: [6, 24, 5.001], fov: 38, near: 0.05, far: 250 }}
      gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
      onCreated={({ gl }) => {
        gl.toneMapping = ACESFilmicToneMapping
        gl.toneMappingExposure = 1.12
        gl.shadowMap.type = PCFSoftShadowMap
      }}
    >
      <RenderResourceScope>
        <Scene timeline={timeline} onReady={onReady} />
      </RenderResourceScope>
    </Canvas>
  )
}
