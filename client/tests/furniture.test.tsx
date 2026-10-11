import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { blankLevel, duplicateLevel, normalizeProject, translateLevel } from '../src/domain/levels'
import { fixtureProject } from '../src/domain/fixture'
import { transformElement } from '../src/domain/elementEditing'
import { detectFurniture } from '../src/furniture/detection'
import { acceptFurniture } from '../src/furniture/acceptance'
import { furnitureIssues, newFurniture } from '../src/furniture/entities'
import { furnitureParts } from '../src/furniture/assets'
import { furnitureTypes } from '../src/furniture/types'
import { FurnitureInspector } from '../src/furniture/FurnitureInspector'
import { useProject } from '../src/state/project'
import { useFurnitureReview } from '../src/furniture/reviewState'
import { createRoofGeometryCache } from '../src/domain/roofGeometryCache'

const p = (x: number, z: number) => ({ x, z })
function raster() {
  const width = 400, height = 320, pixels = new Uint8ClampedArray(width * height * 4).fill(255)
  const rect = (x: number, y: number, w: number, h: number) => {
    for (let yy = y; yy <= y + h; yy++) for (let xx = x; xx <= x + w; xx++) if (yy === y || yy === y + h || xx === x || xx === x + w) {
      const i = (yy * width + xx) * 4; pixels[i] = pixels[i + 1] = pixels[i + 2] = 0
    }
  }
  rect(5, 5, 390, 310); rect(80, 80, 60, 80); rect(85, 86, 22, 14); rect(112, 86, 22, 14)
  rect(220, 80, 26, 24) // plain furniture must remain unknown
  const level = blankLevel('Floor', 0, 3.2)
  level.rooms = [{ id: 'room', name: 'Bedroom', material: 'oak', polygon: [p(.125, .125), p(9.875, .125), p(9.875, 7.875), p(.125, 7.875)] }]
  level.walls = level.rooms[0].polygon.map((start, i) => ({ id: `wall:${i}`, start, end: level.rooms[0].polygon[(i + 1) % 4], thickness: .1, height: 3, material: 'plaster' }))
  return { pixels, width, height, sourceWidth: width, level, levels: [level], sourceId: 'source', calibration: { a: p(0, 0), b: p(400, 0), knownMetres: 10, metresPerPixel: .025 } }
}
test('separate furniture pass finds pillow evidence and leaves unfamiliar rectangles for review', () => {
  const job = raster(), original = JSON.stringify(job.level), candidates = detectFurniture(job)
  expect(JSON.stringify(job.level)).toBe(original)
  const bed = candidates.find(c => c.type === 'bed')!
  expect(bed).toBeDefined(); expect(bed.confidence).toBeGreaterThan(.8); expect(bed.width).toBeCloseTo(1.525); expect(bed.roomId).toBe('room')
  expect(bed.sourceBounds.x).toBe(80); expect(candidates.every(c => c.status === 'uncertain')).toBe(true)
  expect(candidates.some(c => c.type === 'unknown')).toBe(true)
  // Transparent dark RGB is white, not a false symbol.
  const transparent = raster(); for (let i = 3; i < transparent.pixels.length; i += 4) transparent.pixels[i] = 0
  expect(detectFurniture(transparent)).toHaveLength(0)
})
test('only reviewed acceptance creates semantic entities and repeated later analysis does not duplicate them', () => {
  const job = raster(), candidates = detectFurniture(job), walls = JSON.stringify(job.level.walls)
  acceptFurniture(job.level, candidates, job.levels); expect(job.level.furniture || []).toHaveLength(0)
  candidates[0].status = 'accepted'; acceptFurniture(job.level, candidates, job.levels); acceptFurniture(job.level, candidates, job.levels)
  expect(job.level.furniture).toHaveLength(1); expect(JSON.stringify(job.level.walls)).toBe(walls)
  expect(job.level.furniture![0].sourceDetectionId).toBe(candidates[0].id)
  job.level.locked = true; candidates[1].status = 'accepted'; acceptFurniture(job.level, candidates, job.levels); expect(job.level.furniture).toHaveLength(1)
})
test('accepted furniture survives save/load, floor alignment, duplication, and shared editing without changing structure', () => {
  const project = fixtureProject(), level = project.buildings[0].levels[0], object = newFurniture(level, 'bed', p(6.5, 6))
  level.furniture = [object]; const normalized = normalizeProject(JSON.parse(JSON.stringify(project)))
  expect(normalized.buildings[0].levels[0].furniture).toEqual([object])
  const structural = JSON.stringify([level.walls, level.doors, level.rooms])
  const result = transformElement(project, { kind: 'furniture', id: object.id }, { move: p(.2, .3), rotate: 90, scale: 1.1 })
  expect(result.issue).toBeNull(); const moved = result.project.buildings[0].levels[0].furniture![0]
  expect(moved.position).toEqual(p(6.7, 6.3)); expect(moved.rotation).toBe(90)
  expect(JSON.stringify([result.project.buildings[0].levels[0].walls, result.project.buildings[0].levels[0].doors, result.project.buildings[0].levels[0].rooms])).toBe(structural)
  expect(transformElement(project, { kind: 'furniture', id: object.id }, { height: -10 }).issue).toBeTruthy()
  translateLevel(level, p(2, 1)); expect(object.position).toEqual(p(8.5, 7))
  const copy = duplicateLevel(level, 'Upper', 3.2); expect(copy.furniture![0].levelId).toBe(copy.id); expect(copy.furniture![0].id).not.toBe(object.id)
  expect(normalizeProject(fixtureProject()).buildings[0].levels[0].furniture).toEqual([])
})
test('room-aware checks warn rather than moving problematic furniture', () => {
  const job = raster(), bed = newFurniture(job.level, 'bed', p(-1, -1)), previous = structuredClone(bed)
  expect(furnitureIssues(bed, job.level).issues).toContain('Outside a complete room or floor footprint'); expect(bed).toEqual(previous)
  bed.position = p(.15, 1); expect(furnitureIssues(bed, job.level).issues).toContain('Intersects a wall or doorway')
})

test('furniture edits and previews preserve architectural cache references and independent undo history', () => {
  const project = fixtureProject(), object = newFurniture(project.buildings[0].levels[0], 'sofa', p(2, 2))
  project.buildings[0].levels[0].furniture = [object]; useProject.getState().setProject(project)
  const before = useProject.getState().project!, building = before.buildings[0], level = building.levels[0]
  const cache = createRoofGeometryCache(), roofs = cache(building)
  useProject.getState().editProject(copy => { copy.buildings[0].levels[0].furniture![0].position.x += .3; return copy })
  const edited = useProject.getState().project!, owner = edited.buildings[0].levels[0]
  expect(owner.walls).toBe(level.walls); expect(owner.rooms).toBe(level.rooms); expect(owner.slabs).toBe(level.slabs)
  expect(owner.doors).toBe(level.doors); expect(edited.buildings[0].roof).toBe(building.roof)
  expect(cache(edited.buildings[0])).toBe(roofs)
  expect(level.furniture![0].position.x).toBe(2)
  const preview = transformElement(edited, { kind: 'furniture', id: object.id }, { move: p(.2, 0) })
  useProject.getState().preview(preview.project)
  expect(useProject.getState().project!.buildings[0].levels[0].walls).toBe(level.walls)
  useProject.getState().cancelPreview(); expect(useProject.getState().project).toBe(edited)
  useProject.getState().undo(); expect(useProject.getState().project).toBe(before)
  useProject.getState().redo(); expect(useProject.getState().project).toBe(edited)
  useProject.getState().edit(model => ({ ...model, walls: model.walls.map((wall, i) => i === 0 ? { ...wall, height: wall.height + .1 } : wall) }))
  expect(useProject.getState().project!.buildings[0].levels[0].walls).not.toBe(level.walls)
  expect(cache(useProject.getState().project!.buildings[0])).not.toBe(roofs)
})
test('every library category has reusable bounded geometry and an editable inspector', () => {
  const project = fixtureProject(), level = project.buildings[0].levels[0]
  for (const type of furnitureTypes) {
    const object = newFurniture(level, type, p(2, 2)), parts = furnitureParts(object)
    expect(parts.length).toBeGreaterThan(2); expect(parts.length).toBeLessThan(25)
    expect(parts.every(part => part.size.every(value => Number.isFinite(value) && value > 0))).toBe(true)
  }
  const object = newFurniture(level, 'bed', p(2, 2)); level.furniture = [object]; useProject.getState().setProject(project)
  const html = renderToStaticMarkup(<FurnitureInspector level={level} selection={{ kind: 'furniture', id: object.id }} open />)
  for (const label of ['Variant', 'Position X', 'Position Z', 'Duplicate', 'Delete furniture', 'queen', 'Color']) expect(html).toContain(label)
  useFurnitureReview.getState().begin('source', detectFurniture(raster())); useFurnitureReview.getState().toggle(); expect(useFurnitureReview.getState().shown).toBe(false)
  useFurnitureReview.getState().toggle(); useFurnitureReview.getState().clear()
})
