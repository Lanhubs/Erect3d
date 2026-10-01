import { duplicateLevel, newSlab, wallEnvelope } from './levels'
import { defaultRoof, uid, type Building, type Column, type Level, type Point, type Project, type Roof, type RoofSection,
  type Room, type SeatingSection, type Stair, type Wall } from './types'
import { generateSiteFence } from '../geometry/site'
import { splitRoofFootprint } from '../geometry/roofSections'
import { stairOpening } from '../geometry/stairs'

export type SampleCategory = 'Residential' | 'Commercial' | 'Public' | 'Public / Sports'
export type ArchitecturalSample = { id: string; category: SampleCategory; title: string; description: string; project: Project }
const p = (x: number, z: number): Point => ({ x, z })
const createWall = (start: Point, end: Point, height = 3.1, thickness = .22, kind: Wall['kind'] = 'exterior'): Wall => ({
  id: uid('wall'), start, end, height, thickness, kind, material: 'plaster',
})

type RoomPlan = { name: string; polygon: Point[]; material: Room['material']; category?: string }
function makeLevel(name: string, elevation: number, outline: Point[], roomPlans: RoomPlan[], partitions: Array<[Point, Point]> = []): Level {
  const walls = outline.map((point, index) => createWall(point, outline[(index + 1) % outline.length]))
  walls.push(...partitions.map(([start, end]) => createWall(start, end, 3.1, .14, 'interior')))
  return { id: uid('level'), name, elevation, floorToFloorHeight: 3.2, walls, doors: [], windows: [], passages: [],
    rooms: roomPlans.map(room => ({ ...room, id: uid('room') })), slabThickness: .24,
    slabs: [newSlab(outline.map(point => ({ ...point })), .24)], autoSlab: false, columns: [], stairs: [], ramps: [] }
}
function makeProject(name: string, buildingName: string, levels: Level[], roof: Roof = { ...defaultRoof }): Project {
  const building: Building = { id: uid('building'), name: buildingName, levels, roof: { ...roof } }
  return { id: uid('project'), name, modified: Date.now(), buildings: [building], sources: [], units: 'm' }
}
function addStandardOpenings(level: Level) {
  const outer = level.walls.slice(0, 4)
  outer.forEach((wall, index) => {
    const length = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z)
    if (length > 7) level.windows.push({ id: uid('window'), wallId: wall.id, offset: length * .34, width: Math.min(1.8, length * .2), height: 1.35, sill: .9 })
    if (index === 2 && length > 4) level.doors.push({ id: uid('door'), wallId: wall.id, offset: length * .54, width: 1.05, height: 2.2, hinge: 'left', style: 'panel' })
  })
}
function addInternalDoors(level: Level, wallStart = 4) {
  level.walls.slice(wallStart).forEach((wall, index) => {
    if (index % 2) return
    const length = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z)
    if (length > 1.5) level.doors.push({ id: uid('door'), wallId: wall.id, offset: Math.min(1, length * .25), width: .85, height: 2.1, hinge: 'left' })
  })
}
function curvedWall(center: Point, radius: number, startAngle: number, endAngle: number, height = 5, thickness = .25): Wall {
  const curve = { center: { ...center }, radius, startAngle, endAngle }
  const start = { x: center.x + Math.cos(startAngle) * radius, z: center.z + Math.sin(startAngle) * radius }
  const end = { x: center.x + Math.cos(endAngle) * radius, z: center.z + Math.sin(endAngle) * radius }
  return { ...createWall(start, end, height, thickness), curve }
}
function room(name: string, polygon: Point[], material: Room['material'] = 'concrete', category?: string): RoomPlan {
  return { name, polygon, material, category }
}
function seating(name: string, start: Point, end: Point, outward: Point, rows: number, seatsPerRow: number,
  seatColor = '#456f78'): SeatingSection {
  return { id: uid('seating'), name, start, end, outward, rows, seatsPerRow, rowDepth: .82, rowRise: .38,
    baseElevation: .3, seatColor }
}
function attachSite(project: Project, front = 5) {
  const level = project.buildings[0].levels[0]
  const siteFence = generateSiteFence(level, { front, rear: 4, left: 3, right: 3 })
  if (siteFence) project.buildings[0].siteFence = siteFence
}
function linkStair(from: Level, to: Level, start: Point, direction = 0, form: Stair['form'] = 'straight') {
  const openingId = uid('opening')
  const stair: Stair = { id: uid('stair'), fromLevelId: from.id, toLevelId: to.id, start, direction, form,
    width: 1.2, riserHeight: .17, treadDepth: .28, landingLength: 1.2, openingId }
  from.stairs ||= []; from.stairs.push(stair)
  const polygon = stairOpening(stair, [from, to])
  to.slabs ||= []
  if (!to.slabs.length) to.slabs.push(newSlab(wallEnvelope(to), to.slabThickness))
  to.slabs[0].openings.push({ id: openingId, kind: 'stair', polygon })
}
function addRoofSections(building: Building, level: Level, materials: Roof['material'][] = ['standing-seam', 'concrete-tile']) {
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

function houseSample(): Project {
  const outline = [p(0, 0), p(14, 0), p(14, 10), p(0, 10)]
  const rooms = [
    room('Living', [p(0, 0), p(7, 0), p(7, 6), p(0, 6)], 'oak', 'living'),
    room('Dining', [p(7, 0), p(14, 0), p(14, 5), p(7, 5)], 'tile', 'dining'),
    room('Kitchen', [p(7, 5), p(10, 5), p(10, 10), p(7, 10)], 'porcelain-tile', 'kitchen'),
    room('Bedroom 01', [p(0, 6), p(4.5, 6), p(4.5, 10), p(0, 10)], 'oak', 'bedroom'),
    room('Bath', [p(4.5, 6), p(7, 6), p(7, 10), p(4.5, 10)], 'tile', 'bathroom'),
    room('Bedroom 02', [p(10, 5), p(14, 5), p(14, 10), p(10, 10)], 'oak', 'bedroom'),
  ]
  const level = makeLevel('Ground floor', 0, outline, rooms, [[p(7, 0), p(7, 10)], [p(0, 6), p(7, 6)], [p(10, 5), p(14, 5)]])
  addStandardOpenings(level); addInternalDoors(level)
  const project = makeProject('Willow Court House', 'Willow Court House', [level], { ...defaultRoof, shape: 'gable', pitch: 28 })
  attachSite(project)
  return project
}

function villaSample(): Project {
  const outline = [p(0, 0), p(18, 0), p(18, 12), p(11, 12), p(11, 17), p(0, 17)]
  const rooms = [
    room('Gallery', [p(0, 0), p(8, 0), p(8, 9), p(0, 9)], 'marble', 'living'),
    room('Kitchen / dining', [p(8, 0), p(18, 0), p(18, 6), p(8, 6)], 'porcelain-tile', 'kitchen'),
    room('Courtyard loggia', [p(8, 6), p(18, 6), p(18, 12), p(11, 12), p(11, 9), p(8, 9)], 'concrete', 'veranda'),
    room('Primary suite', [p(0, 9), p(8, 9), p(8, 17), p(0, 17)], 'oak', 'bedroom'),
    room('Study', [p(8, 12), p(11, 12), p(11, 17), p(8, 17)], 'timber', 'study'),
  ]
  const ground = makeLevel('Garden level', 0, outline, rooms, [[p(8, 0), p(8, 9)], [p(0, 9), p(11, 9)], [p(8, 12), p(11, 12)]])
  ground.walls.push(curvedWall(p(9.5, 7.5), 1.8, -Math.PI / 2, Math.PI / 2, 3.2, .16))
  addStandardOpenings(ground); addInternalDoors(ground)
  ground.slabs?.push(newSlab([p(-2, 0), p(0, 0), p(0, 8), p(-2, 8)], .18))
  const upper = duplicateLevel(ground, 'Upper residence', 3.4)
  upper.floorToFloorHeight = 3.1
  upper.rooms = [room('Lounge', [p(0, 0), p(9, 0), p(9, 8), p(0, 8)], 'oak', 'living'),
    room('Suite', [p(9, 0), p(18, 0), p(18, 8), p(9, 8)], 'timber', 'bedroom')].map(item => ({ ...item, id: uid('room') }))
  const project = makeProject('Juniper Ridge Villa', 'Juniper Ridge Villa', [ground, upper], { ...defaultRoof, shape: 'hip', pitch: 22 })
  project.buildings[0].levels = [ground, upper]
  addRoofSections(project.buildings[0], upper)
  attachSite(project, 7)
  return project
}

function apartmentSample(): Project {
  const outline = [p(0, 0), p(24, 0), p(24, 16), p(0, 16)]
  const rooms = [
    room('Lobby', [p(0, 0), p(6, 0), p(6, 6), p(0, 6)], 'porcelain-tile', 'lobby'),
    room('Unit A · living', [p(6, 0), p(16, 0), p(16, 8), p(6, 8)], 'oak', 'living'),
    room('Unit A · bedroom', [p(0, 6), p(10, 6), p(10, 16), p(0, 16)], 'oak', 'bedroom'),
    room('Unit B · living', [p(16, 0), p(24, 0), p(24, 8), p(16, 8)], 'timber', 'living'),
    room('Unit B · bedroom', [p(10, 8), p(24, 8), p(24, 16), p(10, 16)], 'oak', 'bedroom'),
  ]
  const ground = makeLevel('Ground floor', 0, outline, rooms, [[p(6, 0), p(6, 16)], [p(16, 0), p(16, 16)], [p(0, 6), p(10, 6)], [p(10, 8), p(24, 8)]])
  addStandardOpenings(ground); addInternalDoors(ground)
  const second = duplicateLevel(ground, 'Level 01', 3.2), third = duplicateLevel(ground, 'Level 02', 6.4)
  linkStair(ground, second, p(1.4, 1.2), 0, 'L')
  linkStair(second, third, p(1.4, 1.2), 0, 'L')
  for (const [index, level] of [second, third].entries()) {
    level.rooms[0].name = `Shared lobby ${index + 1}`
    level.rooms[1].name = `Apartment ${index * 2 + 1}`
    level.rooms[3].name = `Apartment ${index * 2 + 2}`
    const balcony = index % 2 ? [p(24, 3), p(27, 3), p(27, 9), p(24, 9)] : [p(-3, 3), p(0, 3), p(0, 9), p(-3, 9)]
    level.slabs?.push(newSlab(balcony, .18))
  }
  const project = makeProject('Meridian Apartments', 'Meridian Apartments', [ground, second, third], { ...defaultRoof, shape: 'hidden', material: 'concrete' })
  return project
}

function officeSample(): Project {
  const outline = [p(0, 0), p(32, 0), p(32, 22), p(0, 22)]
  const rooms = [room('Reception', [p(0, 0), p(10, 0), p(10, 7), p(0, 7)], 'polished-concrete', 'lobby'),
    room('Open office · west', [p(0, 7), p(14, 7), p(14, 22), p(0, 22)], 'carpet', 'office'),
    room('Meeting suite', [p(14, 0), p(32, 0), p(32, 7), p(14, 7)], 'oak', 'meeting'),
    room('Open office · east', [p(14, 7), p(32, 7), p(32, 22), p(14, 22)], 'carpet', 'office')]
  const level = makeLevel('Office floor', 0, outline, rooms, [[p(10, 0), p(10, 7)], [p(14, 0), p(14, 22)], [p(0, 7), p(32, 7)]])
  addStandardOpenings(level); addInternalDoors(level)
  for (const x of [8, 16, 24]) for (const z of [5, 11, 17]) {
    const column: Column = { id: uid('column'), position: p(x, z), shape: 'circular', width: .45, depth: .45, diameter: .45, height: 3.4, material: 'steel' }
    level.columns?.push(column)
  }
  const level1 = duplicateLevel(level, 'Level 01', 3.4)
  linkStair(level, level1, p(2, 9), 0, 'U')
  const project = makeProject('Northline Studio Offices', 'Northline Studio', [level, level1], { ...defaultRoof, shape: 'hidden', material: 'standing-seam' })
  addRoofSections(project.buildings[0], level1, ['standing-seam', 'concrete'])
  return project
}

function mallSample(): Project {
  const outline = [p(0, 0), p(32, 0), p(32, 10), p(25, 10), p(25, 24), p(7, 24), p(7, 10), p(0, 10)]
  const rooms = [room('Central atrium', [p(12, 8), p(20, 8), p(20, 17), p(12, 17)], 'porcelain-tile', 'atrium'),
    room('West retail wing', [p(0, 0), p(12, 0), p(12, 24), p(7, 24), p(7, 10), p(0, 10)], 'tile', 'retail'),
    room('East retail wing', [p(20, 0), p(32, 0), p(32, 10), p(25, 10), p(25, 24), p(20, 24)], 'tile', 'retail'),
    room('Food hall', [p(12, 17), p(20, 17), p(20, 24), p(12, 24)], 'polished-concrete', 'food hall'),
    room('Main concourse', [p(12, 0), p(20, 0), p(20, 8), p(12, 8)], 'marble', 'circulation')]
  const ground = makeLevel('Concourse', 0, outline, rooms, [[p(12, 0), p(12, 8)], [p(20, 0), p(20, 8)], [p(12, 17), p(20, 17)]])
  ground.slabs![0].openings.push({ id: uid('opening'), kind: 'void', polygon: [p(12, 8), p(20, 8), p(20, 17), p(12, 17)] })
  addStandardOpenings(ground); addInternalDoors(ground)
  const upper = duplicateLevel(ground, 'Upper gallery', 5.2)
  upper.slabs![0].openings.push({ id: uid('opening'), kind: 'void', polygon: [p(12, 8), p(20, 8), p(20, 17), p(12, 17)] })
  upper.rooms = [room('Upper west shops', [p(7, 0), p(12, 0), p(12, 24), p(7, 24)], 'tile', 'retail'),
    room('Upper east shops', [p(20, 0), p(25, 0), p(25, 24), p(20, 24)], 'tile', 'retail')].map(item => ({ ...item, id: uid('room') }))
  linkStair(ground, upper, p(9.5, 2), 90, 'U')
  linkStair(ground, upper, p(22, 12), 0, 'L')
  const project = makeProject('Central Walk Mall', 'Central Walk', [ground, upper], { ...defaultRoof, shape: 'hidden', material: 'standing-seam' })
  addRoofSections(project.buildings[0], upper, ['standing-seam', 'concrete-tile', 'concrete', 'standing-seam'])
  return project
}

function publicBuildingSample(): Project {
  const outline = [p(0, 2), p(14, 0), p(23, 6), p(20, 19), p(11, 24), p(0, 18)]
  const rooms = [room('Forum hall', [p(5, 5), p(17, 5), p(17, 15), p(5, 15)], 'polished-concrete', 'hall'),
    room('Community room', [p(0, 2), p(5, 5), p(5, 15), p(0, 18)], 'tile', 'community'),
    room('Library wing', [p(17, 5), p(23, 6), p(20, 19), p(17, 15)], 'oak', 'library'),
    room('Civic gallery', [p(5, 15), p(17, 15), p(11, 24), p(0, 18)], 'marble', 'gallery')]
  const ground = makeLevel('Public level', 0, outline, rooms, [[p(5, 5), p(5, 15)], [p(17, 5), p(17, 15)], [p(5, 15), p(17, 15)]])
  ground.walls.push(curvedWall(p(11, 10), 3.6, Math.PI, Math.PI * 2, 5.5, .2))
  addStandardOpenings(ground); addInternalDoors(ground)
  ground.ramps?.push({ id: uid('ramp'), start: p(1, 18), end: p(8, 21), width: 1.8, thickness: .16,
    startElevation: 0, endElevation: .9, material: 'reinforced-concrete' })
  const upper = duplicateLevel(ground, 'Upper gallery', 5.5)
  upper.rooms = [room('Exhibition hall', [p(2, 3), p(19, 4), p(18, 18), p(3, 19)], 'concrete', 'exhibition')]
    .map(item => ({ ...item, id: uid('room') }))
  linkStair(ground, upper, p(7, 7), 45, 'L')
  const project = makeProject('Harbor Civic Forum', 'Harbor Civic Forum', [ground, upper], { ...defaultRoof, shape: 'shed', pitch: 10 })
  addRoofSections(project.buildings[0], upper)
  return project
}

function stadiumSample(): Project {
  const fieldX = 52.5, fieldZ = 34, outerX = 70, outerZ = 52
  const outline = [p(-outerX, -outerZ), p(outerX, -outerZ), p(outerX, outerZ), p(-outerX, outerZ)]
  const rooms = [
    room('Football pitch', [p(-fieldX, -fieldZ), p(fieldX, -fieldZ), p(fieldX, fieldZ), p(-fieldX, fieldZ)], 'carpet', 'football-pitch'),
    room('North concourse', [p(-66, -51), p(66, -51), p(66, -44), p(-66, -44)], 'polished-concrete', 'concourse'),
    room('South concourse', [p(-66, 44), p(66, 44), p(66, 51), p(-66, 51)], 'polished-concrete', 'concourse'),
    room('West service gallery', [p(-69, -43), p(-62, -43), p(-62, 43), p(-69, 43)], 'concrete', 'service'),
    room('East service gallery', [p(62, -43), p(69, -43), p(69, 43), p(62, 43)], 'concrete', 'service'),
    room('Players tunnel', [p(-8, -44), p(8, -44), p(8, -36), p(-8, -36)], 'concrete', 'tunnel'),
    room('Changing rooms', [p(-21, 44), p(-2, 44), p(-2, 51), p(-21, 51)], 'tile', 'changing'),
    room('Officials / first aid', [p(2, 44), p(21, 44), p(21, 51), p(2, 51)], 'tile', 'service'),
  ]
  const partitions: Array<[Point, Point]> = [
    [p(-62, -43), p(-62, 43)], [p(62, -43), p(62, 43)],
    [p(-21, 44), p(-21, 51)], [p(-2, 44), p(-2, 51)], [p(2, 44), p(2, 51)], [p(21, 44), p(21, 51)],
    [p(8, -44), p(8, -36)], [p(-8, -44), p(-8, -36)],
  ]
  const ground = makeLevel('Pitch and lower stands', 0, outline, rooms, partitions)
  ground.floorToFloorHeight = 8.4
  ground.rooms.find(item => item.category === 'football-pitch')!.material = 'carpet'
  addStandardOpenings(ground)
  const sideRanges: Array<[number, number]> = [[-54, -28], [-26, -1], [1, 26], [28, 54]]
  ground.seatingSections = []
  for (const [start, end] of sideRanges) {
    ground.seatingSections.push(seating('North stand', p(start, -fieldZ), p(end, -fieldZ), p(0, -1), 12, 46, '#336b73'))
    ground.seatingSections.push(seating('South stand', p(end, fieldZ), p(start, fieldZ), p(0, 1), 12, 46, '#8b4c48'))
  }
  const endRanges: Array<[number, number]> = [[-30, -3], [3, 30]]
  for (const [start, end] of endRanges) {
    ground.seatingSections.push(seating('West goal stand', p(-fieldX, end), p(-fieldX, start), p(-1, 0), 9, 32, '#b28a42'))
    ground.seatingSections.push(seating('East goal stand', p(fieldX, start), p(fieldX, end), p(1, 0), 9, 32, '#596f8b'))
  }
  const upper = duplicateLevel(ground, 'Upper concourse', 8.4)
  upper.floorToFloorHeight = 5.1
  upper.seatingSections = []
  upper.rooms = [room('North upper concourse', [p(-66, -51), p(66, -51), p(66, -45), p(-66, -45)], 'polished-concrete', 'concourse'),
    room('South upper concourse', [p(-66, 45), p(66, 45), p(66, 51), p(-66, 51)], 'polished-concrete', 'concourse'),
    room('East upper gallery', [p(62, -44), p(69, -44), p(69, 44), p(62, 44)], 'concrete', 'concourse'),
    room('West upper gallery', [p(-69, -44), p(-62, -44), p(-62, 44), p(-69, 44)], 'concrete', 'concourse')]
    .map(item => ({ ...item, id: uid('room') }))
  const project = makeProject('Championship Football Stadium', 'Eastbank Football Ground', [ground, upper],
    { ...defaultRoof, shape: 'hidden', material: 'standing-seam' })
  for (const wall of ground.walls.slice(0, 4)) {
    if (ground.doors.some(door => door.wallId === wall.id)) continue
    const length = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z)
    ground.doors.push({ id: uid('door'), wallId: wall.id, offset: length / 2 - 1.5, width: 3,
      height: 2.8, hinge: 'left', style: 'double' })
  }
  linkStair(ground, upper, p(-60, -38), 0, 'U')
  linkStair(ground, upper, p(60, 38), Math.PI, 'U')
  for (const x of [-58, -30, 0, 30, 58]) for (const z of [-47, 47])
    ground.columns?.push({ id: uid('column'), position: p(x, z), shape: 'rectangular', width: .65, depth: .65,
      diameter: .65, height: 11.5, material: 'steel' })
  for (const z of [-49, 49]) project.buildings[0].roofSections = [...(project.buildings[0].roofSections || []), {
    id: uid('roof-section'), name: z < 0 ? 'North stand canopy' : 'South stand canopy', levelId: upper.id,
    footprint: [p(-67, z - 3), p(67, z - 3), p(67, z + 3), p(-67, z + 3)], topHeight: 11.5,
    roof: { shape: 'shed', material: 'standing-seam', color: '#59666b', pitch: 8, overhang: .3 },
  }]
  attachSite(project, 9)
  return project
}

function tableTennisSample(): Project {
  const outline = [p(0, 0), p(48, 0), p(48, 34), p(0, 34)]
  const rooms = [
    room('Competition hall', [p(8, 5), p(40, 5), p(40, 29), p(8, 29)], 'polished-concrete', 'table-tennis-hall'),
    room('Entrance lobby', [p(0, 0), p(15, 0), p(15, 5), p(0, 5)], 'porcelain-tile', 'lobby'),
    room('Ticketing / reception', [p(0, 5), p(8, 5), p(8, 11), p(0, 11)], 'tile', 'service'),
    room('Changing rooms', [p(0, 11), p(8, 11), p(8, 22), p(0, 22)], 'tile', 'changing'),
    room('Officials / first aid', [p(0, 22), p(8, 22), p(8, 29), p(0, 29)], 'tile', 'service'),
    room('Utilities / storage', [p(8, 29), p(40, 29), p(40, 34), p(8, 34)], 'concrete', 'service'),
    room('Public circulation', [p(15, 0), p(48, 0), p(48, 5), p(15, 5)], 'polished-concrete', 'circulation'),
    room('East circulation', [p(40, 5), p(48, 5), p(48, 29), p(40, 29)], 'polished-concrete', 'circulation'),
  ]
  const ground = makeLevel('Competition floor', 0, outline, rooms, [
    [p(15, 0), p(15, 5)], [p(8, 5), p(8, 29)], [p(0, 11), p(8, 11)], [p(0, 22), p(8, 22)],
    [p(8, 29), p(40, 29)], [p(40, 5), p(40, 29)],
  ])
  ground.floorToFloorHeight = 10.5
  addStandardOpenings(ground); addInternalDoors(ground)
  ground.seatingSections = [
    seating('West bleachers', p(13, 10), p(13, 24), p(-1, 0), 6, 20, '#456f78'),
    seating('East bleachers', p(35, 24), p(35, 10), p(1, 0), 6, 20, '#456f78'),
  ]
  const mezzanine = duplicateLevel(ground, 'Upper spectator gallery', 4.5)
  mezzanine.seatingSections = []
  mezzanine.rooms = [room('West gallery', [p(8, 8), p(11, 8), p(11, 26), p(8, 26)], 'concrete', 'concourse'),
    room('East gallery', [p(37, 8), p(40, 8), p(40, 26), p(37, 26)], 'concrete', 'concourse')]
    .map(item => ({ ...item, id: uid('room') }))
  const project = makeProject('Indoor Table-Tennis Arena', 'Eastbank Table-Tennis Hall', [ground, mezzanine],
    { ...defaultRoof, shape: 'gable', material: 'standing-seam', pitch: 12, overhang: .4 })
  linkStair(ground, mezzanine, p(5, 12), 0, 'L')
  for (const x of [8, 24, 40]) for (const z of [3, 31]) ground.columns?.push({ id: uid('column'), position: p(x, z),
    shape: 'rectangular', width: .55, depth: .55, diameter: .55, height: 10.5, material: 'steel' })
  const roof: RoofSection = { id: uid('roof-section'), name: 'Main hall long-span roof', levelId: ground.id,
    footprint: outline.map(point => ({ ...point })), topHeight: 10.5,
    roof: { ...defaultRoof, shape: 'gable', pitch: 12, overhang: .4 } }
  project.buildings[0].roofSections = [roof]
  return project
}

export function createSampleLibrary(): ArchitecturalSample[] {
  const house = houseSample(), villa = villaSample(), apartment = apartmentSample(), office = officeSample(),
    mall = mallSample(), publicBuilding = publicBuildingSample(), stadium = stadiumSample(), tableTennis = tableTennisSample()
  return [
    { id: 'house', category: 'Residential', title: 'Willow Court House', description: 'Single-storey family plan with living, dining, kitchen, bedrooms, bath and a fenced garden.', project: house },
    { id: 'villa', category: 'Residential', title: 'Juniper Ridge Villa', description: 'Split-wing villa with a curved gallery wall, upper suite, veranda and varied roof sections.', project: villa },
    { id: 'apartment', category: 'Residential', title: 'Meridian Apartments', description: 'Three repeated residential levels with shared circulation and cantilevered balconies.', project: apartment },
    { id: 'office', category: 'Commercial', title: 'Northline Studio Offices', description: 'Two commercial floors with open work areas, meeting suite, reception and a structural column grid.', project: office },
    { id: 'mall', category: 'Commercial', title: 'Central Walk Mall', description: 'Two retail galleries arranged around a large atrium void with independently modeled roof sections.', project: mall },
    { id: 'public', category: 'Public', title: 'Harbor Civic Forum', description: 'Irregular public complex with curved hall wall, community rooms, exhibition floor and accessible ramp.', project: publicBuilding },
    { id: 'stadium', category: 'Public / Sports', title: 'Eastbank Championship Ground', description: 'Compact football ground with a 105 × 68 m marked pitch, four pitch-facing stand banks, aisle gaps, concourses, changing rooms, entries and partial canopies.', project: stadium },
    { id: 'table-tennis', category: 'Public / Sports', title: 'Eastbank Table-Tennis Hall', description: 'Enclosed competition hall with marked courts, courtside bleachers, lobby, circulation, changing rooms and a long-span gable roof.', project: tableTennis },
  ]
}
