import { expect, test } from 'bun:test'
import { normalizeProject } from '../src/domain/levels'
import { createSampleLibrary } from '../src/domain/sampleLibrary'

test('sample library offers building projects without retired sports templates', () => {
  const samples = createSampleLibrary()
  expect(samples.map((sample) => sample.id)).toEqual([
    'furnished-house',
    'house',
    'villa',
    'apartment',
    'office',
    'asterion-tower',
    'mall',
    'public',
  ])
  expect(new Set(samples.map((sample) => sample.category))).toEqual(
    new Set(['Residential', 'Commercial', 'Public']),
  )
  for (const sample of samples) {
    const project = normalizeProject(sample.project)
    const building = project.buildings[0]
    expect(project.sources).toHaveLength(0)
    expect(building.levels.length).toBeGreaterThan(0)
    expect(building.levels.some((level) => level.walls.length > 0 && level.rooms.length > 0)).toBe(true)
  }
  expect(samples.find((sample) => sample.id === 'apartment')!.project.buildings[0].levels.length).toBe(3)
  expect(
    samples
      .find((sample) => sample.id === 'mall')!
      .project.buildings[0].levels.some((level) =>
        level.slabs?.some((slab) => slab.openings.some((opening) => opening.kind === 'void')),
      ),
  ).toBe(true)
  expect(
    samples.find((sample) => sample.id === 'public')!.project.buildings[0].levels[0].ramps?.length,
  ).toBeGreaterThan(0)
  expect(
    samples
      .find((sample) => sample.id === 'public')!
      .project.buildings[0].levels[0].walls.some((wall) => Boolean(wall.curve)),
  ).toBe(true)
}, 15000)
