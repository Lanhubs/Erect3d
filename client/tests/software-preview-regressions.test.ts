import { expect, test } from 'bun:test'
import { fixtureProject } from '../src/domain/fixture'
import { softwareDetails } from '../src/rendering/softwareDetails'
import { drawWalkMap } from '../src/rendering/walkMap'
import { newVeranda } from '../src/geometry/veranda'
import type { Stair } from '../src/domain/types'
import { levelBoundsPoints } from '../src/geometry/elementBounds'

test('software recovery preserves structural heights, selections and guarded verandas without filling source margins', () => {
  const project = fixtureProject(),
    level = project.buildings[0].levels[0]
  const upper = { ...structuredClone(level), id: 'upper', elevation: 3.3 }
  level.columns = [
    {
      id: 'column',
      position: { x: 2, z: 2 },
      shape: 'rectangular',
      width: 0.4,
      depth: 0.6,
      diameter: 0.4,
      height: 3.3,
      material: 'concrete',
      rotation: 30,
    },
    {
      id: 'round-column',
      position: { x: 4, z: 2 },
      shape: 'circular',
      width: 0.4,
      depth: 0.4,
      diameter: 0.5,
      height: 3.3,
      material: 'steel',
    },
  ]
  level.ramps = [
    {
      id: 'ramp',
      start: { x: 1, z: 1 },
      end: { x: 4, z: 1 },
      width: 1.2,
      thickness: 0.15,
      startElevation: 0.1,
      endElevation: 1.2,
      material: 'concrete',
    },
  ]
  level.details = [
    {
      id: 'parapet',
      name: 'Parapet',
      kind: 'parapet',
      start: { x: 0, z: 0 },
      end: { x: 4, z: 0 },
      baseElevation: 2.7,
      height: 0.4,
      depth: 0.2,
      spacing: 1,
      material: 'concrete',
    },
  ]
  level.seatingSections = [
    {
      id: 'legacy-seats',
      name: 'Retained legacy seating',
      start: { x: 1, z: 1 },
      end: { x: 4, z: 1 },
      outward: { x: 0, z: 1 },
      rows: 3,
      seatsPerRow: 4,
      rowDepth: 0.8,
      rowRise: 0.3,
      baseElevation: 0.1,
      seatColor: '#353535',
      rowWidthGrowth: 0.2,
    },
  ]
  const door = level.doors[0]
  door.veranda = { ...newVeranda(level, door), railing: true, covered: true }
  for (const form of ['straight', 'L', 'U'] as Stair['form'][]) {
    level.stairs = [
      {
        id: 'stair',
        fromLevelId: level.id,
        toLevelId: upper.id,
        start: { x: 2, z: 2 },
        direction: 35,
        form,
        width: 1.1,
        riserHeight: 0.17,
        treadDepth: 0.28,
        landingLength: 1.2,
      },
    ]
    const before = JSON.stringify(level)
    const faces = softwareDetails(level, [level, upper], true)
    expect(
      faces.every((face) => face.vertices.length >= 3 && face.vertices.flat().every(Number.isFinite)),
    ).toBe(true)
    expect(
      Math.max(
        ...faces
          .filter((face) => face.select?.id === 'column')
          .flatMap((face) => face.vertices.map((v) => v[1])),
      ),
    ).toBeCloseTo(3.3)
    expect(
      Math.max(
        ...faces
          .filter((face) => face.select?.id === 'stair')
          .flatMap((face) => face.vertices.map((v) => v[1])),
      ),
    ).toBeCloseTo(3.3)
    expect(Math.max(...faces.find((face) => face.key === 'ramp')!.vertices.map((v) => v[1]))).toBe(1.2)
    expect(
      faces.find((face) => face.key === level.rooms[0].id)!.vertices.map(([x, , z]) => ({ x, z })),
    ).toEqual(level.rooms[0].polygon)
    expect(faces.some((face) => face.key.startsWith(`${door.id}:cover`))).toBe(true)
    const uncovered = softwareDetails(level, [level, upper], false)
    expect(uncovered.some((face) => face.key.startsWith(`${door.id}:cover`))).toBe(false)
    expect(uncovered.some((face) => face.key.startsWith(`${door.id}:rail`))).toBe(true)
    expect(JSON.stringify(level)).toBe(before)
  }
})

test('walk minimap fits an outlying camera, preserves openings and tolerates missing canvas support', () => {
  const level = fixtureProject().buildings[0].levels[0]
  level.doors.push({ ...level.doors[0], id: 'orphan', wallId: 'missing-wall' })
  const calls: { name: string; values: number[] }[] = []
  const context = Object.fromEntries(
    [
      'fillRect',
      'beginPath',
      'moveTo',
      'lineTo',
      'stroke',
      'save',
      'translate',
      'rotate',
      'closePath',
      'fill',
      'restore',
    ].map((name) => [name, (...values: number[]) => calls.push({ name, values })]),
  )
  const canvas = { width: 240, height: 160, getContext: () => context } as unknown as HTMLCanvasElement
  drawWalkMap(canvas, level, 120, -80, 0.5)
  expect(calls.flatMap((call) => call.values).every(Number.isFinite)).toBe(true)
  const player = calls.find((call) => call.name === 'translate')!
  expect(player.values[0]).toBeGreaterThanOrEqual(10)
  expect(player.values[0]).toBeLessThanOrEqual(230)
  expect(player.values[1]).toBeGreaterThanOrEqual(10)
  expect(player.values[1]).toBeLessThanOrEqual(150)
  expect(calls.find((call) => call.name === 'rotate')!.values).toEqual([-0.5])
  expect(calls.filter((call) => call.name === 'stroke')).toHaveLength(
    level.walls.length + level.doors.length - 1,
  )
  expect(() =>
    drawWalkMap({ getContext: () => null } as unknown as HTMLCanvasElement, level, 0, 0, 0),
  ).not.toThrow()
  drawWalkMap(canvas, { ...level, walls: [], doors: [] }, 0, 0, 0)
  expect(calls.flatMap((call) => call.values).every(Number.isFinite)).toBe(true)
})

test('model framing includes outlying columns, access ramps, screens, stairs and legacy stepped seating', () => {
  const level = fixtureProject().buildings[0].levels[0]
  const upper = { ...structuredClone(level), id: 'upper-bounds', elevation: 3.3 }
  level.columns = [
    {
      id: 'rectangular',
      position: { x: 20, z: 0 },
      shape: 'rectangular',
      width: 6,
      depth: 8,
      diameter: 1,
      height: 3,
      material: 'concrete',
    },
    {
      id: 'circular',
      position: { x: 30, z: 0 },
      shape: 'circular',
      width: 1,
      depth: 1,
      diameter: 2,
      height: 3,
      material: 'steel',
    },
  ]
  level.ramps = [
    {
      id: 'access',
      start: { x: 35, z: 10 },
      end: { x: 40, z: 10 },
      width: 4,
      thickness: 0.2,
      startElevation: 0,
      endElevation: 1,
      material: 'concrete',
    },
  ]
  level.details = [
    {
      id: 'screen',
      name: 'Screen',
      kind: 'screen',
      start: { x: 50, z: 20 },
      end: { x: 60, z: 20 },
      baseElevation: 0,
      height: 3,
      depth: 2,
      spacing: 1,
      material: 'timber',
    },
  ]
  level.seatingSections = [
    {
      id: 'stepped',
      name: 'Legacy terrace',
      start: { x: 70, z: 0 },
      end: { x: 80, z: 0 },
      outward: { x: 0, z: 1 },
      rows: 3,
      seatsPerRow: 6,
      rowDepth: 0.8,
      rowRise: 0.3,
      rowWidthGrowth: 2,
      baseElevation: 0,
      seatColor: '#444444',
    },
  ]
  level.stairs = [
    {
      id: 'exterior-stair',
      fromLevelId: level.id,
      toLevelId: upper.id,
      start: { x: 90, z: 0 },
      direction: 0,
      form: 'straight',
      width: 1.2,
      riserHeight: 0.17,
      treadDepth: 0.28,
      landingLength: 1.2,
    },
  ]
  const before = JSON.stringify(level),
    bounds = levelBoundsPoints(level, [level, upper])
  for (const [x, z] of [
    [25, 5],
    [31, 1],
    [42, 12],
    [60, 22],
    [82, 2.4],
  ])
    expect(bounds.some((point) => Math.abs(point.x - x) < 1e-6 && Math.abs(point.z - z) < 1e-6)).toBe(true)
  expect(Math.max(...bounds.map((point) => point.x))).toBeGreaterThan(90)
  expect(levelBoundsPoints(level).some((point) => point === level.stairs![0].start)).toBe(true)
  expect(JSON.stringify(level)).toBe(before)
})
