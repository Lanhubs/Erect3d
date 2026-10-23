import { newSlab } from './levels'
import { defaultRoof, uid, type Level, type Point, type Project, type Stair } from './types'
import { stairOpening } from '../geometry/stairs'
import { findStairPlacement, stairPlacementValid } from '../geometry/stairPlacement'
import {
  p,
  room,
  makeLevel,
  makeProject,
  createWall,
  seating,
  addStandardOpenings,
  attachSite,
  curvedWall,
  detail,
} from './sampleHelpers'

export function stadiumSample(): Project {
  const fieldX = 52.5,
    fieldZ = 34,
    outerX = 70,
    outerZ = 52
  const outline = [p(-outerX, -outerZ), p(outerX, -outerZ), p(outerX, outerZ), p(-outerX, outerZ)]
  const rooms = [
    room(
      'Football pitch',
      [p(-fieldX, -fieldZ), p(fieldX, -fieldZ), p(fieldX, fieldZ), p(-fieldX, fieldZ)],
      'carpet',
      'football-pitch',
    ),
    room(
      'North concourse',
      [p(-66, -51), p(66, -51), p(66, -44), p(-66, -44)],
      'polished-concrete',
      'concourse',
    ),
    room('South concourse', [p(-66, 44), p(66, 44), p(66, 51), p(-66, 51)], 'polished-concrete', 'concourse'),
    room('West service gallery', [p(-69, -43), p(-62, -43), p(-62, 43), p(-69, 43)], 'concrete', 'service'),
    room('East service gallery', [p(62, -43), p(69, -43), p(69, 43), p(62, 43)], 'concrete', 'service'),
    room('Players tunnel', [p(-8, -44), p(8, -44), p(8, -36), p(-8, -36)], 'concrete', 'tunnel'),
    room('Changing rooms', [p(-21, 44), p(-2, 44), p(-2, 51), p(-21, 51)], 'tile', 'changing'),
    room('Officials / first aid', [p(2, 44), p(21, 44), p(21, 51), p(2, 51)], 'tile', 'service'),
  ]
  const partitions: Array<[Point, Point]> = [
    [p(-62, -43), p(-62, 43)],
    [p(62, -43), p(62, 43)],
    [p(-21, 44), p(-21, 51)],
    [p(-2, 44), p(-2, 51)],
    [p(2, 44), p(2, 51)],
    [p(21, 44), p(21, 51)],
    [p(8, -44), p(8, -36)],
    [p(-8, -44), p(-8, -36)],
  ]
  const ground = makeLevel('Pitch and lower stands', 0, outline, rooms, partitions)
  ground.floorToFloorHeight = 8.4
  ground.walls.slice(0, 4).forEach((wall) => {
    wall.material = 'concrete'
    wall.height = 3.6
    wall.thickness = 0.35
  })
  ground.rooms.find((item) => item.category === 'football-pitch')!.material = 'carpet'
  addStandardOpenings(ground)
  ground.windows = ground.windows.filter(
    (window) => !ground.walls.slice(0, 4).some((wall) => wall.id === window.wallId),
  )
  const sideRanges: Array<[number, number]> = [
    [-54, -28],
    [-26, -1],
    [1, 26],
    [28, 54],
  ]
  ground.seatingSections = []
  for (const [start, end] of sideRanges) {
    ground.seatingSections.push(
      seating('North stand', p(start, -fieldZ), p(end, -fieldZ), p(0, -1), 12, 46, '#336b73'),
    )
    ground.seatingSections.push(
      seating('South stand', p(end, fieldZ), p(start, fieldZ), p(0, 1), 12, 46, '#8b4c48'),
    )
  }
  for (const [start, end] of [
    [-28, -26],
    [-1, 1],
    [26, 28],
  ]) {
    ground.seatingSections.push({
      ...seating('North stand stair aisle', p(start, -fieldZ), p(end, -fieldZ), p(0, -1), 12, 1),
      aisle: true,
    })
    ground.seatingSections.push({
      ...seating('South stand stair aisle', p(end, fieldZ), p(start, fieldZ), p(0, 1), 12, 1),
      aisle: true,
    })
  }
  const endRanges: Array<[number, number]> = [
    [-30, -3],
    [3, 30],
  ]
  for (const [start, end] of endRanges) {
    ground.seatingSections.push(
      seating('West goal stand', p(-fieldX, end), p(-fieldX, start), p(-1, 0), 9, 32, '#b28a42'),
    )
    ground.seatingSections.push(
      seating('East goal stand', p(fieldX, start), p(fieldX, end), p(1, 0), 9, 32, '#596f8b'),
    )
  }
  ground.seatingSections.push({
    ...seating('West stand access aisle', p(-fieldX, 1), p(-fieldX, -1), p(-1, 0), 9, 1),
    aisle: true,
  })
  ground.seatingSections.push({
    ...seating('East stand access aisle', p(fieldX, -1), p(fieldX, 1), p(1, 0), 9, 1),
    aisle: true,
  })
  ground.details = [
    detail('North pitch barrier', 'railing', p(-52, -33.4), p(52, -33.4), 1.1, 0, 0.1, 1.25),
    detail('South pitch barrier', 'railing', p(52, 33.4), p(-52, 33.4), 1.1, 0, 0.1, 1.25),
    detail('West pitch barrier', 'railing', p(-51.8, 32), p(-51.8, -32), 1.1, 0, 0.1, 1.25),
    detail('East pitch barrier', 'railing', p(51.8, -32), p(51.8, 32), 1.1, 0, 0.1, 1.25),
    detail('North concourse rail', 'railing', p(-60, -45), p(60, -45), 1.2, 5.8, 0.11, 1.4),
    detail('South concourse rail', 'railing', p(60, 45), p(-60, 45), 1.2, 5.8, 0.11, 1.4),
    detail('Main entrance canopy', 'canopy', p(14, -52), p(-14, -52), 4.1, 0, 4, 1, 'steel'),
  ]
  for (const [x, z, start, end] of [
    [-57, -38, 1.5, 3],
    [57, -38, 0, 1.5],
    [-57, 38, 3, 4.5],
    [57, 38, 4.5, 6],
  ] as const) {
    const corner = curvedWall(p(x, z), 4.5, start, end, 2.5, 0.22)
    corner.material = 'concrete'
    ground.walls.push(corner)
  }
  const galleryPlans = [
    room(
      'North upper concourse',
      [p(-70, -52), p(70, -52), p(70, -45), p(-70, -45)],
      'polished-concrete',
      'concourse',
    ),
    room(
      'South upper concourse',
      [p(-70, 45), p(70, 45), p(70, 52), p(-70, 52)],
      'polished-concrete',
      'concourse',
    ),
    room('East upper gallery', [p(63, -45), p(70, -45), p(70, 45), p(63, 45)], 'concrete', 'concourse'),
    room('West upper gallery', [p(-70, -45), p(-63, -45), p(-63, 45), p(-70, 45)], 'concrete', 'concourse'),
  ]
  const upper: Level = {
    id: uid('level'),
    name: 'Upper spectator concourse',
    elevation: 5.8,
    floorToFloorHeight: 4.4,
    walls: outline.map((point, index) => createWall(point, outline[(index + 1) % outline.length], 1.25, 0.2)),
    doors: [],
    windows: [],
    passages: [],
    rooms: galleryPlans.map((item) => ({ ...item, id: uid('room') })),
    slabThickness: 0.28,
    autoSlab: false,
    slabs: galleryPlans.map((item) => newSlab(item.polygon, 0.28)),
    columns: [],
    stairs: [],
    ramps: [],
    seatingSections: [],
  }
  upper.details = [
    detail('Upper north gallery rail', 'railing', p(-62, -45), p(62, -45), 1.2, 0.28, 0.12, 1.5),
    detail('Upper south gallery rail', 'railing', p(62, 45), p(-62, 45), 1.2, 0.28, 0.12, 1.5),
  ]
  const project = makeProject('Championship Football Stadium', 'Eastbank Football Ground', [ground, upper], {
    ...defaultRoof,
    shape: 'hidden',
    material: 'standing-seam',
  })
  for (const wall of ground.walls.slice(0, 4)) {
    if (ground.doors.some((door) => door.wallId === wall.id)) continue
    const length = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z)
    ground.doors.push({
      id: uid('door'),
      wallId: wall.id,
      offset: length / 2 - 1.5,
      width: 3,
      height: 2.8,
      hinge: 'left',
      style: 'double',
    })
  }
  for (const [start, slabIndex] of [
    [p(-66, -43), 3],
    [p(64, 36), 2],
  ] as const) {
    const initial: Stair = {
      id: uid('stair'),
      fromLevelId: ground.id,
      toLevelId: upper.id,
      start,
      direction: 90,
      form: 'U',
      width: 1.4,
      riserHeight: 0.17,
      treadDepth: 0.28,
      landingLength: 1.4,
      openingId: uid('opening'),
    }
    const targetSlab = upper.slabs![slabIndex]
    const stair = stairPlacementValid(initial, [ground, upper], [targetSlab])
      ? initial
      : findStairPlacement(initial, [ground, upper], [targetSlab], start)
    if (!stair) throw new Error('The stadium stair must connect to its upper concourse')
    ground.stairs!.push(stair)
    targetSlab.openings.push({
      id: stair.openingId!,
      kind: 'stair',
      polygon: stairOpening(stair, [ground, upper]),
    })
  }
  for (const wall of ground.walls.slice(0, 4)) {
    const length = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z)
    for (let offset = 6; offset < length - 8; offset += 18)
      ground.windows.push({
        id: uid('window'),
        wallId: wall.id,
        offset,
        width: 4,
        height: 0.55,
        sill: 2.95,
        frame: 'aluminium',
        type: 'fixed',
      })
  }
  for (const wall of ground.walls.slice(0, 4)) {
    const length = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z)
    for (let offset = 10; offset < length - 8; offset += 18) {
      if (ground.doors.some((door) => door.wallId === wall.id && Math.abs(door.offset - offset) < 5)) continue
      ground.doors.push({
        id: uid('door'),
        wallId: wall.id,
        offset,
        width: 2.5,
        height: 2.8,
        hinge: 'left',
        style: 'double',
        material: 'metal',
      })
    }
  }
  for (const x of [-58, -30, 0, 30, 58])
    for (const z of [-47, 47])
      ground.columns?.push({
        id: uid('column'),
        position: p(x, z),
        shape: 'rectangular',
        width: 0.65,
        depth: 0.65,
        diameter: 0.65,
        height: 9.4,
        material: 'steel',
      })
  for (const x of [-63, 63])
    for (const z of [-30, -10, 10, 30])
      ground.columns?.push({
        id: uid('column'),
        position: p(x, z),
        shape: 'rectangular',
        width: 0.58,
        depth: 0.58,
        diameter: 0.58,
        height: 9.4,
        material: 'steel',
      })
  for (const x of [-60, -40, -20, 0, 20, 40, 60])
    for (const z of [-51, 51])
      ground.columns?.push({
        id: uid('column'),
        position: p(x, z),
        shape: 'rectangular',
        width: 0.46,
        depth: 0.46,
        diameter: 0.46,
        height: 5.8,
        material: 'concrete',
      })
  for (const x of [-69, 69])
    for (const z of [-30, -10, 10, 30])
      ground.columns?.push({
        id: uid('column'),
        position: p(x, z),
        shape: 'rectangular',
        width: 0.46,
        depth: 0.46,
        diameter: 0.46,
        height: 5.8,
        material: 'concrete',
      })
  const canopies: Array<[string, Point[]]> = [
    ['North stand canopy', [p(-67, -49), p(67, -49), p(67, -36), p(-67, -36)]],
    ['South stand canopy', [p(-67, 36), p(67, 36), p(67, 49), p(-67, 49)]],
    ['West goal canopy', [p(-65, -34), p(-55, -34), p(-55, 34), p(-65, 34)]],
    ['East goal canopy', [p(55, -34), p(65, -34), p(65, 34), p(55, 34)]],
  ]
  project.buildings[0].roofSections = canopies.map(([name, footprint]) => ({
    id: uid('roof-section'),
    name,
    levelId: ground.id,
    footprint,
    topHeight: 9.4,
    roof: { shape: 'shed', material: 'standing-seam', color: '#a2adae', pitch: 5, overhang: 0.18 },
  }))
  attachSite(project, 9)
  return project
}
