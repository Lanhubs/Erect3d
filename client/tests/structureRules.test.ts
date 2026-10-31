import { expect, test } from 'bun:test'
import type { Point, SlabOpening } from '../src/domain/types'
import {
  axes,
  centeredVoid,
  number,
  outlineRejected,
  outlineUpdated,
  polygonCenter,
  shiftedPolygon,
  squareColumn,
  stairFieldLabel,
  stairFieldStep,
  stairFields,
} from '../src/features/structure/structureRules'

const p = (x: number, z: number): Point => ({ x, z })
const rect = (x1: number, z1: number, x2: number, z2: number): Point[] => [
  p(x1, z1),
  p(x2, z1),
  p(x2, z2),
  p(x1, z2),
]
const opening = (kind: SlabOpening['kind'], polygon: Point[]): SlabOpening => ({
  id: `${kind}-1`,
  kind,
  polygon,
})
const width = (polygon: Point[]) =>
  Math.max(...polygon.map((point) => point.x)) - Math.min(...polygon.map((point) => point.x))
const depth = (polygon: Point[]) =>
  Math.max(...polygon.map((point) => point.z)) - Math.min(...polygon.map((point) => point.z))
const slab = rect(0, 0, 12, 8)

test('numbered fields fall back for unreadable text but blank text reads as zero', () => {
  expect(number('2.5', 1)).toBe(2.5)
  expect(number('-0.4', 1)).toBe(-0.4)
  expect(number('', 0.2)).toBe(0)
  for (const junk of ['nan', 'abc', 'Infinity', '3abc'])
    expect(`${junk}:${number(junk, 0.2)}`).toBe(`${junk}:0.2`)
})

test('the opening centre readout and its shift agree on one axis', () => {
  const voidOpening = rect(2, 2, 4, 6)
  expect(polygonCenter(voidOpening, 'x')).toBe(3)
  expect(polygonCenter(voidOpening, 'z')).toBe(4)
  expect(
    shiftedPolygon(voidOpening, 'x', 7)
      .map((point) => point.x)
      .sort(),
  ).toEqual([6, 6, 8, 8])
  expect(polygonCenter(shiftedPolygon(voidOpening, 'z', 1), 'z')).toBe(1)
  // The shift stays rigid: the untouched axis keeps every vertex.
  expect(shiftedPolygon(voidOpening, 'z', 1).map((point) => point.x)).toEqual([2, 4, 4, 2])
})

test('one vertex at a time moves along a single axis', () => {
  expect(outlineUpdated(slab, 1, 'z', -2)).toEqual([p(0, 0), p(12, -2), p(12, 8), p(0, 8)])
  expect(outlineUpdated(slab, 0, 'x', 0)).toEqual(slab)
})

test('an outline is rejected when it collapses or drops an opening', () => {
  expect(outlineRejected(slab, [opening('void', rect(2, 2, 4, 4))])).toBe(false)
  expect(outlineRejected(slab, [])).toBe(false)
  // Degenerate: every vertex shares one x, so no area is left.
  expect(outlineRejected(rect(0, 0, 0, 8), [])).toBe(true)
  expect(outlineRejected(rect(0, 0, 3, 8), [opening('void', rect(2, 2, 4, 4))])).toBe(true)
  // Stair openings are policed the same way as voids.
  expect(outlineRejected(rect(0, 0, 12, 1), [opening('stair', rect(1, 0, 3, 2))])).toBe(true)
})

test('added openings stay centred and never exceed the slab extent', () => {
  expect(centeredVoid(slab, 2, 2)).toEqual(rect(5, 3, 7, 5))
  const wide = centeredVoid(slab, 40, 40)
  expect(polygonCenter(wide, 'x')).toBeCloseTo(6, 10)
  expect(polygonCenter(wide, 'z')).toBeCloseTo(4, 10)
  expect(width(wide)).toBeCloseTo(11.8, 10)
  expect(depth(wide)).toBeCloseTo(7.8, 10)
  const narrow = centeredVoid(rect(0, 0, 0.25, 8), 2, 2)
  expect(polygonCenter(narrow, 'x')).toBeCloseTo(0.125, 10)
  expect(width(narrow)).toBeCloseTo(0.1, 10)
  expect(depth(narrow)).toBeCloseTo(2, 10)
})

test('stair fields keep their degree and metre labels', () => {
  expect(stairFields).toEqual(['direction', 'width', 'riserHeight', 'treadDepth', 'landingLength'])
  expect(stairFieldLabel('direction')).toBe('Direction · °')
  expect(stairFieldLabel('riserHeight')).toBe('riser height · m')
  expect(stairFieldStep('direction')).toBe(5)
  expect(stairFieldStep('treadDepth')).toBe(0.01)
})

test('a column keeps a square section across all three stored dimensions', () => {
  expect(squareColumn(0.45)).toEqual({ width: 0.45, depth: 0.45, diameter: 0.45 })
  expect(axes).toEqual(['x', 'z'])
})
