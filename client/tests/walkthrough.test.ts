import { expect, test } from 'bun:test'
import { blankLevel, newSlab } from '../src/domain/levels'
import type { Level, Point, Stair } from '../src/domain/types'
import { newFurniture } from '../src/furniture/entities'
import { buildWalkObstacles, blockedAt } from '../src/walkthrough/collision'
import { buildWalkSurfaces, floorAt } from '../src/walkthrough/grounding'
import { advancePlayer, type WalkWorld } from '../src/walkthrough/movement'
import { type Player } from '../src/walkthrough/types'
import { stairLanding, stairOpening, stairSteps, localToWorld } from '../src/geometry/stairs'
import { furnishedHouseSample } from '../src/domain/furnishedSample'
import { furnitureIssues } from '../src/furniture/entities'
import { SpatialIndex } from '../src/walkthrough/spatial'
import { safeWalkStart } from '../src/walkthrough/start'
const p = (x: number, z: number) => ({ x, z })
const player = (x = 0, z = 0, foot = 0): Player => ({ x, z, foot, vx: 0, vz: 0, vy: 0, grounded: true })
const world = (levels: Level[], doors = new Set<string>()): WalkWorld => ({
  ...buildWalkSurfaces(levels),
  obstacles: buildWalkObstacles(levels, doors),
})
const tick = (body: Player, scene: WalkWorld, time: number, side = 1, yaw = 0, fps = 60) => {
  for (let i = 0; i < Math.round(time * fps); i++)
    advancePlayer(body, scene, { forward: 0, side, yaw, fast: false }, 1 / fps)
}
function drive(body: Player, scene: WalkWorld, target: Point) {
  for (let i = 0; i < 1800; i++) {
    const dx = target.x - body.x,
      dz = target.z - body.z
    if (Math.hypot(dx, dz) < 0.025) {
      body.vx = body.vz = 0
      return
    }
    advancePlayer(body, scene, { forward: 1, side: 0, yaw: Math.atan2(-dx, -dz), fast: false }, 1 / 120)
  }
  throw new Error(`Route blocked at ${body.x},${body.z},${body.foot} toward ${target.x},${target.z}`)
}
function stairScene(form: Stair['form']) {
  const lower = blankLevel('Ground', 0, 3),
    upper = blankLevel('Upper', 3, 3)
  const polygon = [p(-2, -2), p(12, -2), p(12, 12), p(-2, 12)]
  lower.slabs = [newSlab(polygon)]
  upper.slabs = [newSlab(polygon)]
  const stair: Stair = {
    id: 'stair',
    fromLevelId: lower.id,
    toLevelId: upper.id,
    start: p(0, 0),
    direction: 0,
    form,
    width: 1.2,
    riserHeight: 0.17,
    treadDepth: 0.28,
    landingLength: 1.2,
    openingId: 'opening',
  }
  lower.stairs = [stair]
  upper.slabs[0].openings = [{ id: 'opening', kind: 'stair', polygon: stairOpening(stair, [lower, upper]) }]
  return { levels: [lower, upper], stair, scene: world([lower, upper]) }
}
test('walk speed, acceleration, deceleration, and diagonal normalization are frame-rate independent', () => {
  const scene = world([blankLevel('Ground', 0, 3)]),
    results = [30, 60, 144].map((fps) => {
      const body = player()
      tick(body, scene, 3, 1, 0, fps)
      return body
    })
  expect(results[0].x).toBeCloseTo(results[1].x, 5)
  expect(results[1].x).toBeCloseTo(results[2].x, 5)
  expect(results[0].x).toBeGreaterThan(4.4)
  expect(results[0].x).toBeLessThan(4.65)
  const diagonal = player()
  for (let i = 0; i < 180; i++)
    advancePlayer(diagonal, scene, { forward: 1, side: 1, yaw: 0, fast: false }, 1 / 60)
  expect(Math.hypot(diagonal.x, diagonal.z)).toBeCloseTo(results[0].x, 5)
  const stopped = results[1]
  tick(stopped, scene, 1, 0)
  expect(Math.abs(stopped.vx)).toBeLessThan(0.0001)
})
test('walls and closed doors block, open doorways pass, and low lintels block the player volume', () => {
  const level = blankLevel('Ground', 0, 3)
  level.walls = [{ id: 'wall', start: p(0, 0), end: p(0, 4), thickness: 0.2, height: 3, material: 'plaster' }]
  level.doors = [{ id: 'door', wallId: 'wall', offset: 1, width: 1, height: 2.1, hinge: 'left' }]
  const closed = player(-1, 1.5)
  tick(closed, world([level]), 2)
  expect(closed.x).toBeLessThan(-0.25)
  const open = player(-1, 1.5)
  tick(open, world([level], new Set(['door'])), 2)
  expect(open.x).toBeGreaterThan(1)
  const solid = player(-1, 3)
  tick(solid, world([level], new Set(['door'])), 2)
  expect(solid.x).toBeLessThan(-0.3)
  level.doors[0].height = 1.6
  const low = player(-1, 1.5)
  tick(low, world([level], new Set(['door'])), 2)
  expect(low.x).toBeLessThan(-0.3)
})
test('columns, rotated major furniture, and enabled fences collide without render triangle queries', () => {
  const level = blankLevel('Ground', 0, 3)
  level.columns = [
    {
      id: 'column',
      position: p(0, 0),
      shape: 'circular',
      diameter: 0.6,
      width: 0.6,
      depth: 0.6,
      height: 3,
      material: 'concrete',
    },
  ]
  level.furniture = [newFurniture(level, 'bed', p(3, 0))]
  level.furniture[0].rotation = 45
  const scene = world([level])
  expect(blockedAt(scene.obstacles, 0.3, 0, 0)).toBe(true)
  expect(blockedAt(scene.obstacles, 3, 0, 0)).toBe(true)
  expect(blockedAt(scene.obstacles, 3, 0, 3)).toBe(false)
  const fence = {
    id: 'fence',
    name: 'Site',
    height: 1.8,
    thickness: 0.15,
    material: 'metal' as const,
    gates: [],
    segments: [{ id: 'seg', start: p(6, -2), end: p(6, 2), height: 1.8, thickness: 0.15 }],
  }
  expect(blockedAt(buildWalkObstacles([level], new Set(), fence), 6, 0, 0)).toBe(true)
  expect(blockedAt(buildWalkObstacles([level], new Set(), { ...fence, enabled: false }), 6, 0, 0)).toBe(false)
})
test('straight, L and U stairs climb and descend continuously through their actual upper opening', () => {
  for (const form of ['straight', 'L', 'U'] as const) {
    const { levels, stair, scene } = stairScene(form),
      body = player(-0.5, 0),
      steps = stairSteps(stair, levels)
    const landing = stairLanding(stair, levels),
      end = steps.at(-1)!
    const route: Point[] = []
    if (landing) {
      route.push(localToWorld(stair, landing.u, 0), localToWorld(stair, landing.u, landing.v))
      route.push(
        localToWorld(
          stair,
          form === 'U' ? landing.u + landing.sizeU / 2 - 0.01 : landing.u,
          form === 'U' ? stair.width + stair.landingLength : landing.sizeV / 2,
        ),
      )
    }
    const exit =
      form === 'straight'
        ? localToWorld(stair, end.u + end.depth / 2 + 0.35, 0)
        : form === 'L'
          ? localToWorld(stair, end.u, end.v + end.depth / 2 + 0.35)
          : localToWorld(stair, end.u - end.depth / 2 - 0.35, end.v)
    route.push(exit)
    for (const point of route) drive(body, scene, point)
    expect(body.foot).toBeCloseTo(3, 3)
    expect(body.grounded).toBe(true)
    for (const point of route.slice(0, -1).reverse()) drive(body, scene, point)
    drive(body, scene, p(-0.5, 0))
    expect(body.foot).toBeCloseTo(0, 3)
  }
})
test('an intact upper slab blocks a stair route while real floors prevent falling through', () => {
  const { levels } = stairScene('straight')
  levels[1].slabs![0].openings = []
  const scene = world(levels),
    body = player(-0.4, 0)
  tick(body, scene, 6)
  expect(body.foot).toBeLessThan(1.1)
  expect(body.x).toBeLessThan(2)
  const upper = player(8, 8, 3)
  tick(upper, scene, 3, 0)
  expect(upper.foot).toBe(3)
})
test('ramps ground continuously and slab voids permit a controlled gravity descent', () => {
  const lower = blankLevel('Ground', 0, 3),
    upper = blankLevel('Upper', 1, 3)
  lower.ramps = [
    {
      id: 'ramp',
      start: p(0, 0),
      end: p(4, 0),
      width: 1.2,
      thickness: 0.15,
      startElevation: 0,
      endElevation: 1,
      material: 'concrete',
    },
  ]
  upper.slabs = [newSlab([p(4, -2), p(8, -2), p(8, 2), p(4, 2)])]
  const scene = world([lower, upper]),
    body = player(-0.3, 0)
  drive(body, scene, p(4.6, 0))
  expect(body.foot).toBe(1)
  drive(body, scene, p(-0.3, 0))
  expect(body.foot).toBe(0)
  const falling = player(10, 10, 3)
  tick(falling, scene, 2, 0)
  expect(falling.foot).toBe(0)
  expect(falling.grounded).toBe(true)
})
test('spatial partitioning only returns nearby obstacles on large models', () => {
  const items = Array.from({ length: 10000 }, (_, i) => ({ minX: i * 3, maxX: i * 3 + 1, minZ: 0, maxZ: 1 }))
  expect(new SpatialIndex(items).query(30, 0.5)).toHaveLength(1)
})
test('the furnished two-storey sample has clear furniture placements and a naturally climbable stair hall', () => {
  const project = furnishedHouseSample(),
    levels = project.buildings[0].levels,
    scene = world(levels, new Set(levels.flatMap((l) => l.doors.map((d) => d.id))))
  expect(levels).toHaveLength(2)
  expect(levels[0].furniture!.length).toBeGreaterThan(12)
  for (const level of levels)
    for (const object of level.furniture!) expect(furnitureIssues(object, level, levels).issues).toEqual([])
  const body = player(6, 9.5)
  drive(body, scene, p(6, 2.5))
  expect(body.foot).toBeCloseTo(3.2)
  drive(body, scene, p(6, 9.5))
  expect(body.foot).toBeCloseTo(0)
  const start = safeWalkStart(
    levels[0],
    scene,
    { speed: 'normal', start: 'room', roomId: levels[0].rooms[0].id },
    p(0, 0),
  )
  expect(blockedAt(scene.obstacles, start.point.x, start.point.z, start.foot)).toBe(false)
  expect(floorAt(scene, body.x, body.z, body.foot)).toBe(0)
})
