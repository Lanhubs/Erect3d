import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Euler, Vector3 } from 'three'
import type { Level } from '../domain/types'
import { nearbyDoor, walkStart } from '../geometry/walk'
import { buildColliders, collidesPrepared } from '../geometry/walls'

type Props = { level: Level; active: boolean; onUnlock: () => void; openDoors: ReadonlySet<string>
  onToggleDoor: (id: string) => void; onPosition?: (x: number, z: number, yaw: number) => void }
export function WalkController({ level, active, onUnlock, openDoors, onToggleDoor, onPosition }: Props) {
  const { camera, gl } = useThree()
  const keys = useRef(new Set<string>())
  const yaw = useRef(0), pitch = useRef(0)
  const speed = useRef(new Vector3())
  const frameCount = useRef(0)
  const colliders = useMemo(() => buildColliders(level.walls, level.doors, level.windows, openDoors, level.passages), [level.walls, level.doors, level.windows, level.passages, openDoors])
  useEffect(() => {
    if (!active) return
    const keySet = keys.current
    const start = walkStart(level)
    camera.position.set(start.point.x, 1.65, start.point.z)
    yaw.current = start.yaw
    pitch.current = 0
    speed.current.set(0, 0, 0)
    const down = (event: KeyboardEvent) => {
      keys.current.add(event.code)
      if (event.code === 'KeyE' && !event.repeat) {
        const id = nearbyDoor(level, { x: camera.position.x, z: camera.position.z })
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
    const nextX = camera.position.x + speed.current.x * step
    const x = collidesPrepared({ x: nextX, z: camera.position.z }, .22, colliders) ? camera.position.x : nextX
    const nextZ = camera.position.z + speed.current.z * step
    const z = collidesPrepared({ x, z: nextZ }, .22, colliders) ? camera.position.z : nextZ
    camera.position.set(x, 1.65, z)
    if (++frameCount.current % 5 === 0) onPosition?.(x, z, yaw.current)
  })
  return null
}
