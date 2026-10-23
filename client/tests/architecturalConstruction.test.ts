import { expect, test } from 'bun:test'
import { Mesh, MeshBasicMaterial, DoubleSide, Raycaster, Vector3 } from 'three'
import { articulationProfiles } from '../src/domain/articulation'
import type { ArticulationSystem } from '../src/domain/buildingSystems'
import type { Wall, WindowUnit, Level } from '../src/domain/types'
import { articulationParts } from '../src/geometry/articulationCompiler'
import { articulationSurface } from '../src/geometry/articulationSurface'
import { windowAssembly } from '../src/geometry/windowAssembly'
import { windowConstructionIssue } from '../src/domain/windowConstruction'
import { doorLeafAssembly } from '../src/geometry/doorLeafAssembly'
import { projectOpening } from '../src/geometry/openingProjection'
import { atWall } from '../src/geometry/math'
import { architecturalMaterial } from '../src/rendering/architecturalMaterial'
import { compileSystem } from '../src/geometry/systemCompiler'
import { towerValidationSample } from '../src/domain/towerValidationSample'
import { detachTypicalFloor, repeatedDetails } from '../src/domain/typicalFloors'
const detail: ArticulationSystem = {
  id: 'detail',
  name: 'Source detail',
  kind: 'articulation',
  levelId: 'ground',
  origin: 'detected',
  evidence: 'Visible source boundary',
  elevation: 0,
  color: '#b5b5ad',
  profile: 'canopy',
  material: 'concrete',
  path: [
    { x: 0, z: 0 },
    { x: 6, z: 0 },
  ],
  height: 4,
  depth: 1.2,
  thickness: 0.18,
  spacing: 1.2,
  side: 'left',
}
const wall: Wall = {
  id: 'wall',
  start: { x: 0, z: 0 },
  end: { x: 6, z: 0 },
  thickness: 0.22,
  height: 3,
  material: 'plaster',
}
const window: WindowUnit = {
  id: 'window',
  wallId: 'wall',
  offset: 3,
  width: 1.2,
  height: 1.2,
  sill: 1,
  type: 'fixed',
}
const level: Level = {
  id: 'ground',
  name: 'Ground',
  elevation: 0,
  slabThickness: 0.2,
  walls: [wall],
  rooms: [],
  windows: [window],
  doors: [{ id: 'door', wallId: 'wall', offset: 0.8, width: 0.9, height: 2.1, hinge: 'left' }],
}

test('every registered architectural profile emits finite owned placements or an indexed surface without mutating its semantic input', () => {
  for (const profile of articulationProfiles) {
    const source = { ...detail, profile },
      before = JSON.stringify(source),
      parts = articulationParts(source)
    const placements = Object.values(parts).flat()
    expect(placements.length + (profile === 'arch' ? 1 : 0)).toBeGreaterThan(0)
    for (const part of placements) {
      expect([...part.center, ...part.size, part.rotation].every(Number.isFinite)).toBe(true)
      expect(part.size.every((n) => n > 0)).toBe(true)
      expect(part.selection?.id).toBe('detail')
    }
    if (profile === 'arch') {
      const geometry = articulationSurface(source)!
      expect(geometry.index).not.toBeNull()
      expect(geometry.boundingBox?.isEmpty()).toBe(false)
      for (const key of ['position', 'normal', 'uv'])
        expect([...geometry.getAttribute(key).array].every(Number.isFinite)).toBe(true)
      const material = new MeshBasicMaterial({ side: DoubleSide }),
        mesh = new Mesh(geometry, material)
      mesh.updateMatrixWorld()
      expect(new Raycaster(new Vector3(3, 0.5, 3), new Vector3(0, 0, -1)).intersectObject(mesh)).toHaveLength(
        0,
      )
      expect(
        new Raycaster(new Vector3(0.08, 0.5, 3), new Vector3(0, 0, -1)).intersectObject(mesh).length,
      ).toBeGreaterThan(0)
      geometry.dispose()
      material.dispose()
    }
    expect(JSON.stringify(source)).toBe(before)
  }
})

test('cladding retains door and window apertures, and repeated fins leave the entrance clear', () => {
  const cladding = articulationParts({ ...detail, profile: 'cladding', height: 3, depth: 0.08 }, level)
  const area = cladding.body.reduce((sum, p) => sum + p.size[0] * p.size[1], 0)
  expect(area).toBeCloseTo(18 - 0.9 * 2.1 - 1.2 * 1.2)
  const fins = articulationParts({ ...detail, profile: 'fins', height: 3, spacing: 1 }, level)
  expect(fins.body.some((p) => p.center[0] > 0.8 && p.center[0] < 1.7)).toBe(false)
})

test('an irregular balcony keeps its actual platform instead of filling its concave empty area', () => {
  const footprint = [
    { x: 0, z: 0 },
    { x: 5, z: 0 },
    { x: 5, z: 1 },
    { x: 2, z: 1 },
    { x: 2, z: 4 },
    { x: 0, z: 4 },
  ]
  const geometry = articulationSurface({
    ...detail,
    profile: 'balcony',
    path: footprint.slice(0, 2),
    footprint,
  })!
  const material = new MeshBasicMaterial({ side: DoubleSide }),
    mesh = new Mesh(geometry, material)
  mesh.updateMatrixWorld()
  expect(new Raycaster(new Vector3(4, 2, 3), new Vector3(0, -1, 0)).intersectObject(mesh)).toHaveLength(0)
  expect(
    new Raycaster(new Vector3(1, 2, 3), new Vector3(0, -1, 0)).intersectObject(mesh).length,
  ).toBeGreaterThan(0)
  geometry.dispose()
  material.dispose()
})

test('curved canopies keep the real arc and emit indexed finite platform geometry', () => {
  const source = {
    ...detail,
    path: [
      { x: 10, z: 0 },
      { x: 0, z: 10 },
    ],
    curve: { center: { x: 0, z: 0 }, radius: 10, startAngle: 0, endAngle: Math.PI / 2 },
  }
  const geometry = articulationSurface(source, true)!,
    positions = geometry.getAttribute('position')
  expect(geometry.index).not.toBeNull()
  for (let i = 0; i < positions.count; i++) {
    const radius = Math.hypot(positions.getX(i), positions.getZ(i))
    expect(radius).toBeGreaterThan(8.79)
    expect(radius).toBeLessThan(10.01)
  }
  geometry.dispose()
  const columns = articulationParts({ ...source, profile: 'colonnade' }).columns
  expect(columns.length).toBeGreaterThan(4)
  expect(columns.every((p) => Math.abs(Math.hypot(p.center[0], p.center[2]) - 10) < 1e-8)).toBe(true)
})

test('window frames enclose real clear panes with editable divisions and remain seated in their wall', () => {
  const source = {
      ...window,
      mullions: 2,
      transoms: 1,
      frameWidth: 0.06,
      frameDepth: 0.08,
      frameOffset: 0.025,
    },
    before = JSON.stringify(source)
  const assembly = windowAssembly(wall, source)
  expect(assembly.glass).toHaveLength(6)
  for (const pane of assembly.glass) {
    expect(pane.size[2]).toBe(0.008)
    expect(
      assembly.frame.some(
        (frame) =>
          Math.abs(pane.center[0] - frame.center[0]) < frame.size[0] / 2 - 1e-6 &&
          Math.abs(pane.center[1] - frame.center[1]) < frame.size[1] / 2 - 1e-6,
      ),
    ).toBe(false)
  }
  expect(JSON.stringify(source)).toBe(before)
  expect(windowConstructionIssue({ ...window, mullions: 12, frameWidth: 0.2 }, wall)).not.toBeNull()
  expect(windowConstructionIssue({ ...window, frameOffset: 1 }, wall)).not.toBeNull()
})

test('glazed door leaves have an actual glass aperture and no opaque backing', () => {
  const parts = doorLeafAssembly('glazed', 0.9, 2.1),
    pane = parts.glass[0]
  expect(parts.glass).toHaveLength(1)
  expect(
    parts.body.some(
      (p) =>
        Math.abs(p.center[0] - pane.center[0]) < p.size[0] / 2 &&
        Math.abs(p.center[1] - pane.center[1]) < p.size[1] / 2,
    ),
  ).toBe(false)
  expect(doorLeafAssembly('flush', 0.9, 2.1).glass).toHaveLength(0)
  const glass = architecturalMaterial('window-glass', '#c6dde1')
  expect(glass.transparent).toBe(true)
  expect(glass.depthWrite).toBe(false)
  expect(glass.opacity).toBeLessThan(0.5)
  glass.dispose()
  const railing = articulationParts({
    ...detail,
    profile: 'railing',
    height: 1.1,
    depth: 0.08,
    material: 'glass',
  })
  expect(railing.glass.length).toBeGreaterThan(1)
  expect(railing.body).toHaveLength(0)
})

test('source openings on clockwise and counterclockwise walls preserve their arc offsets', () => {
  for (const sign of [-1, 1]) {
    const curve = { center: { x: 0, z: 0 }, radius: 10, startAngle: 0, endAngle: (sign * Math.PI) / 2 },
      host = { ...wall, start: { x: 10, z: 0 }, end: { x: 0, z: sign * 10 }, curve }
    const projected = projectOpening(host, [atWall(host, 3), atWall(host, 4.2)])!
    expect(projected.offset).toBeCloseTo(3, 8)
    expect(projected.width).toBeCloseTo(1.2, 8)
    expect(projectOpening(host, [atWall(host, 3), { x: 1, z: 1 }])).toBeNull()
    const assembly = windowAssembly(host, { ...window, offset: 3, width: 2.4 })
    expect(assembly.glass.length).toBeGreaterThan(1)
    expect(assembly.glass.every((p) => Math.abs(Math.hypot(p.center[0], p.center[2]) - 10) < 0.001)).toBe(
      true,
    )
  }
})

test('a complete circular canopy has a real courtyard hole rather than a duplicate closing seam or centre slab', () => {
  const source = {
    ...detail,
    path: [
      { x: 10, z: 0 },
      { x: 10, z: 0 },
    ],
    curve: { center: { x: 0, z: 0 }, radius: 10, startAngle: 0, endAngle: Math.PI * 2 },
  }
  const geometry = articulationSurface(source, true)!,
    material = new MeshBasicMaterial({ side: DoubleSide }),
    mesh = new Mesh(geometry, material)
  mesh.updateMatrixWorld()
  expect(new Raycaster(new Vector3(0, 8, 0), new Vector3(0, -1, 0)).intersectObject(mesh)).toHaveLength(0)
  expect(
    new Raycaster(new Vector3(9.4, 8, 0), new Vector3(0, -1, 0)).intersectObject(mesh).length,
  ).toBeGreaterThan(0)
  expect([...geometry.getAttribute('normal').array].every(Number.isFinite)).toBe(true)
  geometry.dispose()
  material.dispose()
  expect(() => articulationParts({ ...detail, spacing: 1e-20 })).toThrow('budget')
})

test('only explicitly repeated details follow linked floors and detached copies remain independently editable', () => {
  const project = towerValidationSample(),
    building = project.buildings[0],
    template = building.levels[0]
  const repeated = {
    ...detail,
    levelId: template.id,
    profile: 'balcony' as const,
    height: 1.1,
    repeatWithFloor: true,
  }
  building.systems!.systems.push(repeated, {
    ...repeated,
    id: 'ground-canopy',
    profile: 'canopy',
    repeatWithFloor: false,
  })
  expect(repeatedDetails(building, template.id).map((s) => s.id)).toEqual(['detail'])
  const compiled = compileSystem(repeated, template)
  expect(compiled.articulation!.body.length).toBeGreaterThan(0)
  const group = building.systems!.systems.find((s) => s.kind === 'typical-floors')!,
    before = JSON.stringify(project)
  const detached = detachTypicalFloor(project, building.id, group.id, 4),
    next = detached.buildings[0]
  expect(JSON.stringify(project)).toBe(before)
  const copy = next.systems!.systems.find((s) => s.kind === 'articulation' && s.levelId !== template.id)!
  expect(copy).toMatchObject({ profile: 'balcony', repeatWithFloor: false })
  expect(copy.id).not.toBe(repeated.id)
  if (copy.kind === 'articulation') copy.path[0].x += 1
  expect(repeated.path[0].x).toBe(0)
})
