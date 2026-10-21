import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import type { Level, SiteFence } from '../domain/types'
import type {BuildingSystem} from '../domain/buildingSystems'
import { nearbyDoor } from '../geometry/walk'
import { buildWalkObstacles } from '../walkthrough/collision'
import { buildWalkSurfaces } from '../walkthrough/grounding'
import { advancePlayer } from '../walkthrough/movement'
import { bindWalkInput, type WalkInput } from '../walkthrough/input'
import { safeWalkStart } from '../walkthrough/start'
import { playerShape, type Player, type WalkOptions, type WalkViewpoint } from '../walkthrough/types'
import { useFurnitureReview } from '../furniture/reviewState'
type Props = { levels: Level[]; systems?:BuildingSystem[];startLevelId: string; active: boolean;paused?:boolean; openDoors: ReadonlySet<string>; siteFence?: SiteFence;
  onToggleDoor: (id: string) => void; onCapture: (locked: boolean, dragging?: boolean) => void; options: WalkOptions; viewpoints?: WalkViewpoint[];
  onPosition?: (x: number, z: number, yaw: number, level: Level, foot: number, pitch: number) => void }
export function WalkController({ levels,systems, startLevelId, active,paused=false, openDoors, onToggleDoor, onPosition, siteFence, onCapture, options, viewpoints }: Props) {
  const { camera, gl } = useThree()
  const player = useRef<Player>({ x: 0, z: 0, foot: 0, vx: 0, vz: 0, vy: 0, grounded: true })
  const input = useRef<WalkInput>({ keys: new Set(), yaw: 0, pitch: 0, captured: false, fallback: false })
  const timer = useRef(0), currentLevel = useRef<Level | null>(null)
  const callbacks = useRef({ onToggleDoor, onPosition, onCapture }), settings = useRef(options), entryLevel = useRef(startLevelId)
  const furnitureShown = useFurnitureReview(state => state.shown)
  useEffect(() => { callbacks.current = { onToggleDoor, onPosition, onCapture }; settings.current = options; entryLevel.current = startLevelId }, [onToggleDoor, onPosition, onCapture, options, startLevelId])
  const cachedWorld=useRef<{levels:Level[];systems:Props['systems'];doors:ReadonlySet<string>;fence:Props['siteFence'];furniture:boolean;world:ReturnType<typeof buildWalkSurfaces>&{obstacles:ReturnType<typeof buildWalkObstacles>}}|null>(null)
  const world = useMemo(() => {
    if(!active)return cachedWorld.current?.world||null
    const old=cachedWorld.current
    if(old&&old.levels===levels&&old.systems===systems&&old.doors===openDoors&&old.fence===siteFence&&old.furniture===furnitureShown)return old.world
    const value={...buildWalkSurfaces(levels,systems),obstacles:buildWalkObstacles(levels,openDoors,siteFence,furnitureShown,systems)}
    cachedWorld.current={levels,systems,doors:openDoors,fence:siteFence,furniture:furnitureShown,world:value};return value
  }, [active,levels,systems, openDoors, siteFence, furnitureShown])
  const worldRef = useRef(world), levelsRef = useRef(levels), viewpointsRef = useRef(viewpoints)
  useEffect(() => { worldRef.current = world; levelsRef.current = levels.toSorted((a, b) => b.elevation - a.elevation); viewpointsRef.current = viewpoints }, [world, levels, viewpoints])
  useEffect(() => {
    if (!active||!worldRef.current) return
    const level = levelsRef.current.find(level => level.id === entryLevel.current) || levelsRef.current[0]
    if (!level) return
    const saved = viewpointsRef.current?.find(view => view.id === settings.current.start)
    const startLevel = saved ? levelsRef.current.find(level => level.id === saved.levelId) || level : level
    const start = safeWalkStart(startLevel, worldRef.current, settings.current, { x: camera.position.x, z: camera.position.z }, viewpointsRef.current)
    if (settings.current.start === 'camera') { const direction = camera.getWorldDirection(new Vector3()); start.yaw = Math.atan2(-direction.x, -direction.z); start.pitch = Math.max(-1.45, Math.min(1.45, Math.asin(direction.y))) }
    player.current = { x: start.point.x, z: start.point.z, foot: start.foot, vx: 0, vz: 0, vy: 0, grounded: true }
    currentLevel.current = startLevel; input.current.yaw = start.yaw; input.current.pitch = start.pitch; timer.current = 0
    camera.position.set(start.point.x, start.foot + playerShape.eye, start.point.z)
    callbacks.current.onPosition?.(start.point.x, start.point.z, start.yaw, startLevel, start.foot, start.pitch)
  }, [active, camera, gl])
  useEffect(()=>{
    if(!active||paused)return
    return bindWalkInput(gl.domElement, input.current, (value, dragging) => callbacks.current.onCapture(value, dragging), () => {
      const playerNow = player.current, levelNow = currentLevel.current
      const id = levelNow && nearbyDoor(levelNow, { x: playerNow.x, z: playerNow.z })
      if (id) callbacks.current.onToggleDoor(id)
    })
  }, [active,paused,gl])
  useFrame((_, elapsed) => {
    if (!active || paused || !currentLevel.current) return
    const controller = input.current, p = player.current
    if (controller.captured || controller.fallback) {
      const keys = controller.keys
      advancePlayer(p, worldRef.current!, { forward: Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown')),
        side: Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft')), yaw: controller.yaw,
        fast: settings.current.speed === 'fast' || keys.has('ShiftLeft') || keys.has('ShiftRight') }, elapsed)
    } else { p.vx = 0; p.vz = 0 }
    camera.position.set(p.x, p.foot + playerShape.eye, p.z); camera.rotation.set(controller.pitch, controller.yaw, 0, 'YXZ')
    const matching = levelsRef.current.find(level => p.foot >= level.elevation - .15) || currentLevel.current
    const changed = matching.id !== currentLevel.current.id; currentLevel.current = matching
    timer.current += elapsed
    if (changed || timer.current >= .12) { timer.current = 0; callbacks.current.onPosition?.(p.x, p.z, controller.yaw, matching, p.foot, controller.pitch) }
  })
  return null
}
