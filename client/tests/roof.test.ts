import { expect, test } from 'bun:test'
import { defaultRoof, type RoofShape } from '../src/domain/types'
import { roofLayout } from '../src/geometry/roof'
import { splitRoofFootprint } from '../src/geometry/roofSections'
import { fixtureProject } from '../src/domain/fixture'
import { normalizeProject, wallEnvelope } from '../src/domain/levels'
import { levelOf } from '../src/domain/types'
import { roofClosureRings } from '../src/domain/roofCoverage'
import { clipRoofLayout } from '../src/geometry/roofFootprint'
import { roofOverhang } from '../src/geometry/roofOverhang'
import { roofClosurePanels } from '../src/geometry/roofClosure'
import { softwareRoofs } from '../src/rendering/softwareRoofs'
import { useProject } from '../src/state/project'

const bounds = { minX: 0, maxX: 12, minZ: 0, maxZ: 8, top: 2.9 }

test('all roof forms produce finite surfaces over the building footprint', () => {
  for (const shape of [
    'hidden',
    'gable',
    'hip',
    'shed',
    'mansard',
    'butterfly',
    'terrace',
    'cross-gable',
    'cross-hip',
    'arena-vault',
  ] as RoofShape[]) {
    const layout = roofLayout(bounds, { ...defaultRoof, shape })
    expect(layout.faces.length).toBeGreaterThan(0)
    expect(layout.faces.flat(2).every(Number.isFinite)).toBe(true)
    expect(layout.faces.flat().some((point) => point[1] > bounds.top)).toBe(true)
  }
})

test('cross roof sheets cover the footprint once without overlapping planes or gaps', () => {
  for (const shape of ['cross-gable', 'cross-hip'] as RoofShape[]) {
    const roof = { ...defaultRoof, shape, overhang: 0.4 }
    const faces = roofLayout(bounds, roof).faces
    const projectedArea = faces.reduce(
      (sum, [a, b, c]) => sum + Math.abs((b[0] - a[0]) * (c[2] - a[2]) - (c[0] - a[0]) * (b[2] - a[2])) / 2,
      0,
    )
    expect(faces.every((face) => face.length === 3)).toBe(true)
    expect(projectedArea).toBeCloseTo((12 + 0.8) * (8 + 0.8), 5)
  }
})

test('shed roof has wall infill rather than floating above the house', () => {
  const layout = roofLayout(bounds, { ...defaultRoof, shape: 'shed', pitch: 12 })
  expect(layout.gables.length).toBeGreaterThanOrEqual(3)
  expect(layout.gables.flat().some((point) => point[1] === bounds.top)).toBe(true)
  expect(layout.gables.flat().some((point) => point[1] > bounds.top + 1)).toBe(true)
})

test('roof section splitting preserves a concave footprint on both sides', () => {
  const footprint = [
    { x: 0, z: 0 },
    { x: 12, z: 0 },
    { x: 12, z: 4 },
    { x: 7, z: 4 },
    { x: 7, z: 8 },
    { x: 0, z: 8 },
  ]
  const sections = splitRoofFootprint(footprint)
  expect(sections).not.toBeNull()
  expect(sections![0].every((point) => point.x <= 6 + 1e-8)).toBe(true)
  expect(sections![1].every((point) => point.x >= 6 - 1e-8)).toBe(true)
  expect(sections!.every((polygon) => polygon.length >= 3)).toBe(true)
})

test('roof choices remain part of edits and undo history', () => {
  const project = fixtureProject()
  useProject.getState().setProject(project)
  useProject.getState().edit((model) => ({ ...model, roof: { ...defaultRoof, shape: 'gable' } }))
  expect(levelOf(useProject.getState().project!).roof?.shape).toBe('gable')
  useProject.getState().undo()
  expect(levelOf(useProject.getState().project!).roof?.shape).toBe('hip')
  useProject.getState().redo()
  expect(levelOf(useProject.getState().project!).roof?.shape).toBe('gable')
})

test('manual roof infill meets the wall line inside an expanded roof footprint', () => {
  const project = fixtureProject(),
    level = project.buildings[0].levels[0],
    wallLine = wallEnvelope(level),
    footprint = roofOverhang(wallLine, 0.4),
    roof = { ...defaultRoof, shape: 'hip' as const, overhang: 0.95 }
  const section = {
    id: 'expanded-roof',
    name: 'Expanded roof',
    levelId: level.id,
    footprint,
    topHeight: 3.6,
    roof,
  }
  project.buildings[0].roofSections = [section]
  const xs = footprint.map((point) => point.x),
    zs = footprint.map((point) => point.z),
    top = 3.6
  const layout = clipRoofLayout(
    roofLayout(
      {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minZ: Math.min(...zs),
        maxZ: Math.max(...zs),
        top,
      },
      roof,
    ),
    roofOverhang(footprint, roof.overhang),
  )
  const panels = roofClosurePanels(roofClosureRings(section, level), layout.faces, top),
    bottom = panels.flatMap((face) => face.slice(0, 2)),
    softwareBottom = softwareRoofs(level, project.buildings[0])
      .filter((face) => face.key.includes(':gable:'))
      .flatMap((face) => face.vertices.slice(0, 2))
  expect(panels.length).toBeGreaterThan(0)
  expect(bottom.every(([, y]) => y === top)).toBe(true)
  expect(bottom.some(([x]) => Math.abs(x) < 1e-8)).toBe(true)
  expect(bottom.some(([x]) => Math.abs(x + 0.4) < 1e-8)).toBe(true)
  expect(softwareBottom.some(([x]) => Math.abs(x) < 1e-8)).toBe(true)
})

test('legacy projects keep their single roof and normalized projects retain independent roof sections', () => {
  const project = fixtureProject()
  expect(project.buildings[0].roofSections).toBeUndefined()
  const level = project.buildings[0].levels[0]
  project.buildings[0].roofSections = [
    {
      id: 'roof-a',
      name: 'Main wing',
      levelId: level.id,
      footprint: wallEnvelope(level),
      topHeight: 3.2,
      roof: { ...defaultRoof, shape: 'gable' },
    },
    {
      id: 'roof-b',
      name: 'Service wing',
      levelId: level.id,
      footprint: wallEnvelope(level),
      topHeight: 2.8,
      roof: { ...defaultRoof, shape: 'shed', pitch: 12 },
    },
  ]
  const normalized = normalizeProject(project)
  expect(normalized.buildings[0].roofSections?.map((section) => section.roof.shape)).toEqual([
    'gable',
    'shed',
  ])
  expect(normalized.buildings[0].roofSections?.map((section) => section.topHeight)).toEqual([3.2, 2.8])
})
