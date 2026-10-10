import { expect, test } from 'bun:test'
import { createSampleLibrary } from '../src/domain/sampleLibrary'
import { updateStair } from '../src/domain/structure'
import { stairPlacementValid } from '../src/geometry/stairPlacement'
import { stairLanding, stairOpening, stairSteps } from '../src/geometry/stairs'

const samples = createSampleLibrary()

test('turning flights meet their landing at both edges', () => {
  for (const sample of samples) {
    const levels = sample.project.buildings[0].levels
    for (const level of levels) for (const stair of level.stairs || []) {
      if (stair.form === 'straight') continue
      const steps = stairSteps(stair, levels)
      const landing = stairLanding(stair, levels)!
      const split = Math.ceil(steps.length / 2)
      const first = steps[split - 1], second = steps[split]
      expect(first.u + first.depth / 2).toBeCloseTo(landing.u - landing.sizeU / 2)
      if (stair.form === 'L')
        expect(second.v - second.depth / 2).toBeCloseTo(landing.v + landing.sizeV / 2)
      else
        expect(second.u + second.depth / 2).toBeCloseTo(landing.u + landing.sizeU / 2)
      expect(steps.at(-1)!.height).toBeCloseTo(levels.find(item => item.id === stair.toLevelId)!.elevation - level.elevation)
    }
  }
})

test('every sample stair has a clear route and matching upper slab opening', () => {
  for (const sample of samples) {
    const levels = sample.project.buildings[0].levels
    for (const level of levels) for (const stair of level.stairs || []) {
      const destination = levels.find(item => item.id === stair.toLevelId)!
      expect(stairPlacementValid(stair, levels, destination.slabs || [])).toBe(true)
      const openings = destination.slabs?.flatMap(slab => slab.openings.filter(opening => opening.id === stair.openingId)) || []
      expect(openings).toHaveLength(1)
      const expected = stairOpening(stair, levels)
      expected.forEach((point, index) => {
        expect(openings[0].polygon[index].x).toBeCloseTo(point.x)
        expect(openings[0].polygon[index].z).toBeCloseTo(point.z)
      })
    }
  }
})

test('a stair cannot be moved through a wall or away from the upper slab', () => {
  const project = structuredClone(samples.find(sample => sample.id === 'apartment')!.project)
  const stair = project.buildings[0].levels[0].stairs![0]
  const original = structuredClone(stair.start)
  expect(updateStair(project, stair.id, { start: { x: 100, z: 100 } })).toContain('upper-floor slab')
  expect(stair.start).toEqual(original)
})
