import type { Point } from '../domain/types'
export type WalkViewpoint = {
  id: string
  name: string
  levelId: string
  point: Point
  foot: number
  yaw: number
  pitch: number
}
export type WalkOptions = {
  speed: 'normal' | 'fast'
  start: 'entrance' | 'camera' | 'room' | string
  roomId?: string
}
export type Player = {
  x: number
  z: number
  foot: number
  vx: number
  vz: number
  vy: number
  grounded: boolean
}
export const playerShape = { radius: 0.23, height: 1.78, eye: 1.65, step: 0.3 }
export type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number }
export type Obstacle = Bounds & {
  bottom: number
  top: number
  kind: 'segment' | 'box' | 'circle'
  a: Point
  b?: Point
  radius?: number
  width?: number
  depth?: number
  angle?: number
}
export type Surface = Bounds & {
  heightAt: (point: Point) => number | null
  levelId: string
  transition?: boolean
}
