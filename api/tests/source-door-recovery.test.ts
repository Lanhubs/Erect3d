import { expect, test } from 'bun:test'
import { bridgeOpeningHosts } from '../src/workers/opening-bridges'
import { recoverSourceDoorLeaves } from '../src/workers/source-door-leaves'
import type { Candidate, Intelligence } from '../src/contracts/analysis'
const base = { confidence: 0.9, needsReview: true as const, uncertainties: [], evidence: 'Source geometry' }
const proposal = (candidates: Candidate[]): Intelligence => ({
  coordinatesVersion: 1,
  coordinateSystem: 'normalized-image-top-left',
  candidates,
  warnings: [],
})
test('a doorway ending at a confirmed return wall gets a continuous host without inventing a wall across open space', () => {
  const host: Candidate = {
    ...base,
    id: 'host',
    kind: 'wall',
    thickness: 0.01,
    points: [
      { x: 0.1, y: 0.3 },
      { x: 0.3, y: 0.3 },
    ],
  }
  const corner: Candidate = {
    ...base,
    id: 'return',
    kind: 'wall',
    thickness: 0.01,
    points: [
      { x: 0.4, y: 0.1 },
      { x: 0.4, y: 0.6 },
    ],
  }
  const door: Candidate = {
    ...base,
    id: 'door',
    kind: 'door',
    wallId: host.id,
    points: [
      { x: 0.3, y: 0.3 },
      { x: 0.4, y: 0.3 },
    ],
  }
  const result = bridgeOpeningHosts(proposal([host, corner, door]), 1000, 800)
  expect(result.candidates[0].points[1]).toEqual({ x: 0.4, y: 0.3 })
  expect(result.candidates[2].wallId).toBe(host.id)
  expect(bridgeOpeningHosts(proposal([host, door]), 1000, 800).candidates[0].points).toEqual(host.points)
  expect(
    bridgeOpeningHosts(
      proposal([host, { ...corner, points: corner.points.map((point) => ({ ...point, x: 0.6 })) }, door]),
      1000,
      800,
    ).candidates[0].points,
  ).toEqual(host.points)
  expect(host.points[1].x).toBe(0.3)
})
test('a swung leaf recovers its closed gap only with the source arc, leaf and real host', () => {
  const wall: Candidate = {
    ...base,
    id: 'wall',
    kind: 'wall',
    thickness: 0.02,
    points: [
      { x: 0.5, y: 0.25 },
      { x: 0.5, y: 0.8 },
    ],
  }
  const door: Candidate = {
    ...base,
    id: 'door',
    kind: 'door',
    doorStyle: 'panel',
    points: [
      { x: 0.4, y: 0.5 },
      { x: 0.5, y: 0.5 },
    ],
  }
  const source = proposal([wall, door])
  const ink = (x: number, y: number) =>
    (x >= 80 && x <= 100 && Math.abs(y - 100) <= 0.6) ||
    (x <= 100 && y <= 100 && Math.abs(Math.hypot(x - 100, y - 100) - 20) <= 0.6)
  const result = recoverSourceDoorLeaves(source, 200, 200, ink)
  expect(result.candidates[1].wallId).toBe(wall.id)
  expect(result.candidates[1].points[0].x).toBeCloseTo(0.5)
  expect(result.candidates[1].points[1].x).toBeCloseTo(0.5)
  expect(result.candidates[1].points[1].y).toBeLessThan(0.5)
  expect(source.candidates[1].points).toEqual(door.points)
  expect(recoverSourceDoorLeaves(source, 200, 200, () => false)).toBe(source)
  expect(recoverSourceDoorLeaves(source, 200, 200, () => true)).toBe(source)
  expect(
    recoverSourceDoorLeaves(proposal([wall, { ...door, doorStyle: 'double' }]), 200, 200, ink).candidates[1]
      .points,
  ).toEqual(door.points)
})
