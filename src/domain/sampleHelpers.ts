import { newSlab, wallEnvelope } from './levels'
import { defaultRoof, uid, type Building, type Level, type Point, type Project, type Roof, type RoofSection,
  type Room, type SeatingSection, type Stair, type Wall, type ArchitecturalDetail } from './types'
import { generateSiteFence } from '../geometry/site'
import { splitRoofFootprint } from '../geometry/roofSections'
import { stairOpening } from '../geometry/stairs'

export const p = (x: number, z: number): Point => ({ x, z })
export const createWall = (start: Point, end: Point, height = 3.1, thickness = .22, kind: Wall['kind'] = 'exterior'): Wall => ({
  id: uid('wall'), start, end, height, thickness, kind, material: 'plaster',
})

export type RoomPlan = { name: string; polygon: Point[]; material: Room['material']; category?: string }
export function makeLevel(name: string, elevation: number, outline: Point[], roomPlans: RoomPlan[], partitions: Array<[Point, Point]> = []): Level {
  const walls = outline.map((point, index) => createWall(point, outline[(index + 1) % outline.length]))
  walls.push(...partitions.map(([start, end]) => createWall(start, end, 3.1, .14, 'interior')))
  return { id: uid('level'), name, elevation, floorToFloorHeight: 3.2, walls, doors: [], windows: [], passages: [],
    rooms: roomPlans.map(room => ({ ...room, id: uid('room') })), slabThickness: .24,
    slabs: [newSlab(outline.map(point => ({ ...point })), .24)], autoSlab: false, columns: [], stairs: [], ramps: [] }
}
export function makeProject(name: string, buildingName: string, levels: Level[], roof: Roof = { ...defaultRoof }): Project {
  const building: Building = { id: uid('building'), name: buildingName, levels, roof: { ...roof } }
  return { id: uid('project'), name, modified: Date.now(), buildings: [building], sources: [], units: 'm' }
}
export function addStandardOpenings(level: Level) {
  const outer = level.walls.slice(0, 4)
  outer.forEach((wall, index) => {
    const length = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z)
    if (length > 7) level.windows.push({ id: uid('window'), wallId: wall.id, offset: length * .34, width: Math.min(1.8, length * .2), height: 1.35, sill: .9 })
    if (index === 2 && length > 4) level.doors.push({ id: uid('door'), wallId: wall.id, offset: length * .54, width: 1.05, height: 2.2, hinge: 'left', style: 'panel' })
  })
}
export function addInternalDoors(level: Level, wallStart = 4) {
  level.walls.slice(wallStart).forEach((wall, index) => {
    if (index % 2) return
    const length = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z)
    if (length > 1.5) level.doors.push({ id: uid('door'), wallId: wall.id, offset: Math.min(1, length * .25), width: .85, height: 2.1, hinge: 'left' })
  })
}
export function curvedWall(center: Point, radius: number, startAngle: number, endAngle: number, height = 5, thickness = .25): Wall {
  const curve = { center: { ...center }, radius, startAngle, endAngle }
  const start = { x: center.x + Math.cos(startAngle) * radius, z: center.z + Math.sin(startAngle) * radius }
  const end = { x: center.x + Math.cos(endAngle) * radius, z: center.z + Math.sin(endAngle) * radius }
  return { ...createWall(start, end, height, thickness), curve }
}
export function room(name: string, polygon: Point[], material: Room['material'] = 'concrete', category?: string): RoomPlan {
  return { name, polygon, material, category }
}
export function seating(name: string, start: Point, end: Point, outward: Point, rows: number, seatsPerRow: number,
  seatColor = '#456f78'): SeatingSection {
  return { id: uid('seating'), name, start, end, outward, rows, seatsPerRow, rowDepth: .82, rowRise: .38,
    baseElevation: .3, seatColor }
}
export function detail(name: string, kind: ArchitecturalDetail['kind'], start: Point, end: Point,
  height: number, baseElevation = 0, depth = .2, spacing = 1.2,
  material: ArchitecturalDetail['material'] = 'steel'): ArchitecturalDetail {
  return { id: uid('detail'), name, kind, start, end, height, baseElevation, depth, spacing, material }
}
export function attachSite(project: Project, front = 5) {
  const level = project.buildings[0].levels[0]
  const siteFence = generateSiteFence(level, { front, rear: 4, left: 3, right: 3 })
  if (siteFence) project.buildings[0].siteFence = siteFence
}
export function linkStair(from: Level, to: Level, start: Point, direction = 0, form: Stair['form'] = 'straight') {
  const openingId = uid('opening')
  const stair: Stair = { id: uid('stair'), fromLevelId: from.id, toLevelId: to.id, start, direction, form,
    width: 1.2, riserHeight: .17, treadDepth: .28, landingLength: 1.2, openingId }
  from.stairs ||= []; from.stairs.push(stair)
  const polygon = stairOpening(stair, [from, to])
  to.slabs ||= []
  if (!to.slabs.length) to.slabs.push(newSlab(wallEnvelope(to), to.slabThickness))
  to.slabs[0].openings.push({ id: openingId, kind: 'stair', polygon })
}
export function addRoofSections(building: Building, level: Level, materials: Roof['material'][] = ['standing-seam', 'concrete-tile']) {
  let pieces: Point[][] = [wallEnvelope(level)]
  if (pieces[0].length < 3) return
  while (pieces.length < materials.length) {
    const index = pieces.reduce((best, piece, candidate) => piece.length > pieces[best].length ? candidate : best, 0)
    const split = splitRoofFootprint(pieces[index])
    if (!split) break
    pieces.splice(index, 1, ...split)
  }
  building.roofSections = pieces.map((footprint, index): RoofSection => ({
    id: uid('roof-section'), name: `Roof ${index + 1}`, levelId: level.id, footprint,
    topHeight: Math.max(2.8, ...level.walls.map(wall => wall.height)),
    roof: { ...(building.roof || defaultRoof), shape: index % 2 ? 'shed' : 'gable', material: materials[index % materials.length], overhang: .18 },
  }))
}

