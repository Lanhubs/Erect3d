import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Euler, Vector3 } from 'three'
import type { Level, SiteFence } from '../domain/types'
import { nearbyDoor, walkStart } from '../geometry/walk'
import { stairHeightAt } from '../geometry/stairs'
import { buildColliders, collidesPrepared, siteFenceColliders, type Collider } from '../geometry/walls'

type Props = { levels: Level[]; startLevelId: string; active: boolean; onUnlock: () => void; openDoors: ReadonlySet<string>
  onToggleDoor: (id: string) => void; onPosition?: (x: number, z: number, yaw: number, level: Level) => void; siteFence?: SiteFence }
export function WalkController({ levels, startLevelId, active, onUnlock, openDoors, onToggleDoor, onPosition, siteFence }: Props) {
  const { camera, gl } = useThree()
  const level = levels.find(item => item.id === startLevelId) || levels[0]
  const keys = useRef(new Set<string>())
  const yaw = useRef(0), pitch = useRef(0)
  const speed = useRef(new Vector3())
  const frameCount = useRef(0)
  const signature = JSON.stringify([levels.map(item => [item.id,
    item.walls.map(wall => [wall.id, wall.start, wall.end, wall.thickness, wall.height]),
    item.doors.map(door => [door.id, door.wallId, door.offset, door.width, door.height]),
    item.windows.map(window => [window.id, window.wallId, window.offset, window.width, window.sill, window.height]),
    item.passages?.map(passage => [passage.id, passage.wallId, passage.offset, passage.width, passage.height])]),
  [...openDoors].sort(), siteFence])
  const colliderCache = useRef<{ signature: string; colliders: Map<string, Collider[]> } | null>(null)
  if (colliderCache.current?.signature !== signature) colliderCache.current = { signature, colliders: new Map(levels.map(item => [item.id,
    buildColliders(item.walls, item.doors, item.windows, openDoors, item.passages, undefined)])) }
  const colliders = colliderCache.current.colliders
  const currentLevel = useRef(level)
  useEffect(() => {
    if (!active) return
    const keySet = keys.current
    const start = walkStart(level)
    camera.position.set(start.point.x, level.elevation + 1.65, start.point.z)
    currentLevel.current = level
    yaw.current = start.yaw
    pitch.current = 0
    speed.current.set(0, 0, 0)
    const down = (event: KeyboardEvent) => {
      keys.current.add(event.code)
      if (event.code === 'KeyE' && !event.repeat) {
        const id = nearbyDoor(currentLevel.current, { x: camera.position.x, z: camera.position.z })
        if (id) { event.preventDefault(); onToggleDoor(id) }
      }
    }
    const up = (event: KeyboardEvent) => { keys.current.delete(event.code) }
    const move = (event: MouseEvent) => {
      if (document.pointerLockElement !== gl.domElement && (!(event.buttons & 1) || event.target !== gl.domElement)) return
      yaw.current -= event.movementX * .0022
      pitch.current = Math.max(-1.45, Math.min(1.45, pitch.current - event.movementY * .0022))
    }
    const unlock = () => { if (document.pointerLockElement !== gl.domElement) onUnlock() }
    document.addEventListener('keydown', down); document.addEventListener('keyup', up)
    document.addEventListener('mousemove', move); document.addEventListener('pointerlockchange', unlock)
    return () => {
      document.removeEventListener('keydown', down); document.removeEventListener('keyup', up)
      document.removeEventListener('mousemove', move); document.removeEventListener('pointerlockchange', unlock)
      if (document.pointerLockElement === gl.domElement) document.exitPointerLock()
      keySet.clear()
    }
  }, [active, camera, gl, level, onUnlock, onToggleDoor])
  useFrame((_, delta) => {
    if (!active) return
    const step = Math.min(delta, .05)
    camera.rotation.set(pitch.current, yaw.current, 0, 'YXZ')
    const forward = Number(keys.current.has('KeyW')) - Number(keys.current.has('KeyS'))
    const side = Number(keys.current.has('KeyD')) - Number(keys.current.has('KeyA'))
    const target = new Vector3(side, 0, -forward).normalize().applyEuler(new Euler(0, yaw.current, 0))
    target.multiplyScalar(keys.current.has('ShiftLeft') ? 3.8 : 2.3)
    speed.current.lerp(target, Math.min(1, step * 9))
    const activeSiteFence = Math.abs(currentLevel.current.elevation) < .2 ? siteFence : undefined
    const activeColliders = [...(colliders.get(currentLevel.current.id) || []), ...siteFenceColliders(activeSiteFence)]
    const nextX = camera.position.x + speed.current.x * step
    const x = collidesPrepared({ x: nextX, z: camera.position.z }, .22, activeColliders) ? camera.position.x : nextX
    const nextZ = camera.position.z + speed.current.z * step
    const z = collidesPrepared({ x, z: nextZ }, .22, activeColliders) ? camera.position.z : nextZ
    const point = { x, z }
    const stairs = levels.flatMap(item => item.stairs || [])
    const candidates = stairs.map(stair => {
      const from = levels.find(item => item.id === stair.fromLevelId)
      const height = stairHeightAt(stair, levels, point)
      return from && height !== null ? { stair, elevation: from.elevation + height } : null
    }).filter(item => item !== null)
    const previousFloor = camera.position.y - 1.65
    const stair = candidates.find(item => Math.abs(item.elevation - previousFloor) < .5)
    let floor = stair?.elevation ?? currentLevel.current.elevation
    if (!stair) {
      const landing = levels.filter(item => Math.abs(item.elevation - previousFloor) < .45)
        .sort((a, b) => Math.abs(a.elevation - previousFloor) - Math.abs(b.elevation - previousFloor))[0]
      if (landing) floor = landing.elevation
    }
    const nextY = camera.position.y + Math.max(-step * 4, Math.min(step * 4, floor + 1.65 - camera.position.y))
    camera.position.set(x, nextY, z)
    const matching = [...levels].sort((a, b) => b.elevation - a.elevation).find(item => nextY - 1.65 >= item.elevation - .2)
    if (matching) currentLevel.current = matching
    if (++frameCount.current % 5 === 0) onPosition?.(x, z, yaw.current, currentLevel.current)
  })
  return null
}
