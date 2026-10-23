import { expect, test } from 'bun:test'
import { towerValidationSample } from '../src/domain/towerValidationSample'
import { houseSample } from '../src/domain/residentialSamples'
import { projectSchema } from '../../api/src/contracts/project'
import { validateGeometry } from '../../api/src/modules/projects/geometry-validation'
import { validateSystems } from '../src/domain/systemValidation'
import { detachTypicalFloor, linkedFloorIndices } from '../src/domain/typicalFloors'
import { compileSystem, architecturalBounds, levelWithSystemVoids } from '../src/geometry/systemCompiler'
import { floorPackages } from '../src/geometry/floorPackages'
import { systemMassGeometry } from '../src/geometry/systemMass'
import { createSystem } from '../src/domain/createSystem'
import { systemRoofVoids } from '../src/geometry/systemRoofVoids'
test('a 32-storey building persists one editable template and bounded instanced packages', () => {
  const project = towerValidationSample(),
    building = project.buildings[0],
    group = building.systems!.systems.find((s) => s.kind === 'typical-floors')!
  expect(projectSchema.safeParse(project).success).toBe(true)
  expect(() => validateGeometry(project)).not.toThrow()
  expect(validateSystems(building)).toEqual([])
  expect(building.levels).toHaveLength(1)
  expect(linkedFloorIndices(building, group)).toHaveLength(31)
  expect(architecturalBounds(building).top).toBeCloseTo(115.2)
  const packages = floorPackages(building.levels[0])
  expect(packages.length).toBeLessThan(10)
  for (const p of packages) {
    expect(p.geometry.index).not.toBeNull()
    expect([...p.geometry.getAttribute('position').array].every(Number.isFinite)).toBe(true)
    p.geometry.dispose()
  }
})
test('detaching one floor preserves links, reassigns identities and leaves the input and remaining floors unchanged', () => {
  const input = towerValidationSample(),
    building = input.buildings[0],
    group = building.systems!.systems.find((s) => s.kind === 'typical-floors')!,
    before = JSON.stringify(input)
  const project = detachTypicalFloor(input, building.id, group.id, 17),
    next = project.buildings[0],
    linked = next.systems!.systems.find((s) => s.kind === 'typical-floors')!
  expect(JSON.stringify(input)).toBe(before)
  expect(next.levels).toHaveLength(2)
  expect(next.levels[1].elevation).toBeCloseTo(61.2)
  expect(linkedFloorIndices(next, linked)).toHaveLength(30)
  expect(next.levels[1].walls[0].id).not.toBe(next.levels[0].walls[0].id)
  expect(projectSchema.safeParse(JSON.parse(JSON.stringify(project))).success).toBe(true)
  expect(() => validateGeometry(project)).not.toThrow()
  expect(() => detachTypicalFloor(input, building.id, group.id, 200)).toThrow()
})
test('curtain walls retain semantic curves and compile finite geometry without rectangularizing the source', () => {
  const project = towerValidationSample(),
    facade = createSystem('curtain-wall', project.buildings[0].levels[0])
  if (facade.kind !== 'curtain-wall') throw new Error('Wrong fixture')
  facade.curve = { center: { x: 0, z: 0 }, radius: 12, startAngle: 0, endAngle: Math.PI }
  facade.height = 8
  const original = JSON.stringify(facade),
    result = compileSystem(facade)
  expect(JSON.stringify(facade)).toBe(original)
  expect(result.glass.length).toBeGreaterThan(20)
  for (const part of [...result.glass, ...result.frame])
    expect([...part.center, ...part.size, part.rotation].every(Number.isFinite)).toBe(true)
})
test('invalid topology is rejected before emission and a courtyard is a real indexed geometric hole', () => {
  const project = towerValidationSample(),
    building = project.buildings[0],
    mass = createSystem('massing', building.levels[0])
  if (mass.kind !== 'massing') throw new Error('Wrong fixture')
  mass.holes = [
    [
      { x: 10, z: 8 },
      { x: 20, z: 8 },
      { x: 20, z: 18 },
      { x: 10, z: 18 },
    ],
  ]
  building.systems!.systems.push(mass)
  expect(validateSystems(building)).toEqual([])
  const geometry = systemMassGeometry(mass)
  expect(geometry.index).not.toBeNull()
  expect(geometry.groups.length).toBeGreaterThan(1)
  geometry.dispose()
  mass.polygon = [
    { x: 0, z: 0 },
    { x: 10, z: 10 },
    { x: 0, z: 10 },
    { x: 10, z: 0 },
  ]
  expect(validateSystems(building).length).toBeGreaterThan(0)
  const legacy = houseSample()
  expect(projectSchema.safeParse(legacy).success).toBe(true)
  expect(legacy.buildings[0].systems).toBeUndefined()
})

test('vertical atria cut a roof only when they reach its elevation, without changing the saved roof', () => {
  const building = towerValidationSample().buildings[0],
    level = building.levels[0],
    atrium = createSystem('void', level)
  if (atrium.kind !== 'void') throw new Error('Fixture')
  atrium.polygon = [
    { x: 3, z: 3 },
    { x: 6, z: 3 },
    { x: 6, z: 6 },
    { x: 3, z: 6 },
  ]
  atrium.height = 120
  building.systems!.systems.push(atrium)
  const before = JSON.stringify(building.roofSections),
    cut = systemRoofVoids(building, building.roofSections!)
  expect(cut[0].voids).toHaveLength(2)
  expect(JSON.stringify(building.roofSections)).toBe(before)
  const slabs = levelWithSystemVoids(level, building).slabs
  expect(levelWithSystemVoids({ ...level, furniture: [] }, building).slabs).toBe(slabs)
  atrium.height = 3
  expect(systemRoofVoids(building, building.roofSections!)[0].voids).toHaveLength(1)
})
