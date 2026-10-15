import { expect, test } from 'bun:test'
import { normalizeProject } from '../src/domain/levels'
import { createSampleLibrary } from '../src/domain/sampleLibrary'
import { roomArea } from '../src/geometry/math'
import { containsPoint } from '../src/geometry/polygons'

test('sample library preserves its architecture projects and adds a furnished walkthrough home', () => {
  const samples = createSampleLibrary()
  expect(samples.map(sample => sample.id)).toEqual(['furnished-house', 'house', 'villa', 'apartment', 'office', 'mall', 'public', 'stadium', 'table-tennis'])
  expect(new Set(samples.map(sample => sample.category))).toEqual(new Set(['Residential', 'Commercial', 'Public', 'Public / Sports']))
  for (const sample of samples) {
    const project = normalizeProject(sample.project)
    const building = project.buildings[0]
    expect(project.sources).toHaveLength(0)
    expect(building.levels.length).toBeGreaterThan(0)
    expect(building.levels.some(level => level.walls.length > 0 && level.rooms.length > 0)).toBe(true)
  }
  expect(samples.find(sample => sample.id === 'apartment')!.project.buildings[0].levels.length).toBe(3)
  expect(samples.find(sample => sample.id === 'mall')!.project.buildings[0].levels.some(level => level.slabs?.some(slab => slab.openings.some(opening => opening.kind === 'void')))).toBe(true)
  expect(samples.find(sample => sample.id === 'public')!.project.buildings[0].levels[0].ramps?.length).toBeGreaterThan(0)
  const stadium = samples.find(sample => sample.id === 'stadium')!.project.buildings[0]
  expect(stadium.levels[0].rooms.some(room => room.category === 'football-pitch' && roomArea(room) > 7000)).toBe(true)
  expect(stadium.levels[0].doors.length).toBeGreaterThanOrEqual(4)
  expect(stadium.levels[0].seatingSections?.length).toBeGreaterThanOrEqual(10)
  expect(stadium.roofSections?.length).toBeGreaterThan(1)
  expect(stadium.levels[0].seatingSections?.filter(section => section.aisle).length).toBeGreaterThanOrEqual(8)
  expect(stadium.levels[1].slabs?.every(slab => !containsPoint(slab.polygon, { x: 0, z: 0 }))).toBe(true)
  expect(stadium.roofSections?.every(section => !containsPoint(section.footprint, { x: 0, z: 0 }))).toBe(true)
  expect(stadium.levels[1].slabs).toHaveLength(4)
  expect(samples.find(sample => sample.id === 'public')!.project.buildings[0].levels[0].walls.some(wall => Boolean(wall.curve))).toBe(true)
  const tableTennis = samples.find(sample => sample.id === 'table-tennis')!.project.buildings[0]
  expect(tableTennis.levels[0].rooms.some(room => room.category === 'table-tennis-hall')).toBe(true)
  expect(tableTennis.levels[0].seatingSections?.length).toBe(2)
  expect(tableTennis.levels[1].slabs?.every(slab => !containsPoint(slab.polygon, { x: 24, z: 17 }))).toBe(true)
  expect(tableTennis.roofSections).toHaveLength(3)
  expect(tableTennis.levels[0].walls.some(wall => Boolean(wall.curve))).toBe(true)
  expect(tableTennis.levels[0].details?.some(detail => detail.kind === 'canopy')).toBe(true)
  expect(tableTennis.levels[0].walls.some(wall => wall.height < 6)).toBe(true)
},15000)
