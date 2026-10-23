import type { SpatialIndex } from './spatial'
import { blockedAt } from './collision'
import { floorAt, headBlocked, type GroundWorld } from './grounding'
import type { Obstacle, Player } from './types'
export type WalkWorld = GroundWorld & { obstacles: SpatialIndex<Obstacle> }
export function advancePlayer(
  player: Player,
  world: WalkWorld,
  input: { forward: number; side: number; yaw: number; fast: boolean },
  elapsed: number,
) {
  const total = Math.max(0, Math.min(elapsed, 0.12)),
    iterations = Math.max(1, Math.ceil(total / (1 / 120))),
    dt = total / iterations
  const norm = Math.hypot(input.forward, input.side) || 1,
    speed = input.fast ? 2.8 : 1.55
  const targetX = ((input.side * Math.cos(input.yaw) - input.forward * Math.sin(input.yaw)) / norm) * speed
  const targetZ = ((-input.side * Math.sin(input.yaw) - input.forward * Math.cos(input.yaw)) / norm) * speed
  for (let i = 0; i < iterations; i++) {
    const damping = Math.exp(-12 * dt),
      integral = (1 - damping) / 12
    const dx = targetX * dt + (player.vx - targetX) * integral,
      dz = targetZ * dt + (player.vz - targetZ) * integral
    player.vx = targetX + (player.vx - targetX) * damping
    player.vz = targetZ + (player.vz - targetZ) * damping
    const tryMove = (x: number, z: number) => {
      const floor = floorAt(world, x, z, player.foot),
        foot = floor >= player.foot - 0.45 ? floor : player.foot
      if (blockedAt(world.obstacles, x, z, foot) || headBlocked(world, x, z, foot)) return false
      player.x = x
      player.z = z
      return true
    }
    if (!tryMove(player.x + dx, player.z)) player.vx = 0
    if (!tryMove(player.x, player.z + dz)) player.vz = 0
    const floor = floorAt(world, player.x, player.z, player.foot)
    if (floor >= player.foot - 0.45 && !headBlocked(world, player.x, player.z, floor)) {
      player.foot = floor
      player.vy = 0
      player.grounded = true
    } else {
      player.vy -= 9.81 * dt
      player.foot += player.vy * dt
      player.grounded = false
      if (player.foot < floor) {
        player.foot = floor
        player.vy = 0
        player.grounded = true
      }
    }
  }
  return player
}
