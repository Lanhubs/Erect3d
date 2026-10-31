import { expect, test } from 'bun:test'
import { defaultRoof, type Level, type Ramp, type Wall } from '../src/domain/types'
import { materialColor } from '../src/rendering/materials'
import {
  curveDegrees,
  curveRadians,
  fanGrowth,
  minimumWallLength,
  rampRun,
  rampSlope,
  seatingCount,
  seatingStep,
  wallKind,
  wallPaint,
} from '../src/features/inspector/inspectorRules'

const p = (x: number, z: number) => ({ x, z })
const wall = (over: Partial<Wall> = {}): Wall => ({
  id: 'wall-1',
  start: p(0, 0),
  end: p(8, 0),
  thickness: 0.28,
  height: 2.9,
  material: 'plaster',
  ...over,
})
const ramp = (over: Partial<Ramp> = {}): Ramp => ({
  id: 'ramp-1',
  start: p(0, 0),
  end: p(6, 0),
  width: 1.5,
  thickness: 0.2,
  startElevation: 0,
  endElevation: 0.6,
  material: 'concrete',
  ...over,
})

const emptyLevel = (): Level => ({
  id: 'level-1',
  name: 'Ground floor',
  elevation: 0,
  walls: [wall()],
  doors: [],
  windows: [],
  rooms: [],
  slabThickness: 0.22,
  roof: { ...defaultRoof },
})

test('a wall cannot be resized past the widest opening it hosts', () => {
  const level = emptyLevel()
  expect(minimumWallLength(wall(), level)).toBe(0.1)
  level.doors = [{ id: 'door-1', wallId: 'wall-1', offset: 2.1, width: 1.1, height: 2.1, hinge: 'left' }]
  expect(minimumWallLength(wall(), level)).toBe(3.25)
  level.windows = [{ id: 'window-1', wallId: 'wall-1', offset: 5, width: 1.2, height: 1.2, sill: 0.9 }]
  level.passages = [{ id: 'passage-1', wallId: 'other', offset: 7.5, width: 0.9, height: 2.4 }]
  expect(minimumWallLength(wall(), level)).toBe(6.25)
  // An opening on another wall never constrains this one.
  level.doors = [{ id: 'door-2', wallId: 'other', offset: 7, width: 1, height: 2.1, hinge: 'left' }]
  level.windows = []
  expect(minimumWallLength(wall(), level)).toBe(0.1)
})

test('the ramp readouts come from its own run and rise', () => {
  expect(rampRun(ramp())).toBe(6)
  expect(rampSlope(ramp()).toFixed(1)).toBe('10.0')
  expect(rampSlope(ramp({ endElevation: 0 }))).toBe(0)
  expect(rampSlope(ramp({ end: p(0, 4) })) > 0).toBe(true)
  expect(rampSlope(ramp({ endElevation: -0.6 })).toFixed(1)).toBe('-10.0')
})

test('an unlabelled wall reads its type from the thickness convention', () => {
  expect(wallKind(wall({ kind: undefined, thickness: 0.28 }))).toBe('exterior')
  expect(wallKind(wall({ kind: undefined, thickness: 0.1 }))).toBe('interior')
  expect(wallKind(wall({ kind: 'partition', thickness: 0.28 }))).toBe('partition')
})

test('the paint swatch falls back to the material colour', () => {
  expect(wallPaint(wall({ color: '#ff0000' }))).toBe('#ff0000')
  expect(wallPaint(wall({ material: 'brick' }))).toBe(materialColor.brick)
})

test('curve angles round-trip between radians and the degree fields', () => {
  expect(curveDegrees(Math.PI / 2)).toBe(90)
  expect(curveRadians(90)).toBeCloseTo(Math.PI / 2, 12)
  expect(curveDegrees(0.12345)).toBe(7.1)
  for (const degrees of [0, 45, 137, 359]) expect(curveDegrees(curveRadians(degrees))).toBe(degrees)
})

test('seating edits clamp to whole occupied seats and a bounded fan', () => {
  expect(seatingCount(0)).toBe(1)
  expect(seatingCount(3.6)).toBe(4)
  expect(seatingCount(-12)).toBe(1)
  expect(seatingStep(0)).toBe(0.05)
  expect(seatingStep(0.8)).toBe(0.8)
  expect(fanGrowth(-1)).toBe(0)
  expect(fanGrowth(9)).toBe(5)
  expect(fanGrowth(2.4)).toBe(2.4)
})
