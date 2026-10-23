import { newSlab } from './levels'
import { defaultRoof, uid, type Level, type Point, type Project, type RoofSection, type Wall } from './types'
import {
  p,
  room,
  makeLevel,
  makeProject,
  createWall,
  seating,
  addStandardOpenings,
  addInternalDoors,
  curvedWall,
  detail,
  linkStair,
} from './sampleHelpers'

export function tableTennisSample(): Project {
  const outline = [p(0, 0), p(48, 0), p(48, 34), p(0, 34)]
  const rooms = [
    room(
      'Competition hall',
      [p(8, 5), p(40, 5), p(40, 29), p(8, 29)],
      'polished-concrete',
      'table-tennis-hall',
    ),
    room('Entrance lobby', [p(0, 0), p(15, 0), p(15, 5), p(0, 5)], 'porcelain-tile', 'lobby'),
    room('Ticketing / reception', [p(0, 5), p(8, 5), p(8, 11), p(0, 11)], 'tile', 'service'),
    room('Changing rooms', [p(0, 11), p(8, 11), p(8, 22), p(0, 22)], 'tile', 'changing'),
    room('Officials / first aid', [p(0, 22), p(8, 22), p(8, 29), p(0, 29)], 'tile', 'service'),
    room('Utilities / storage', [p(8, 29), p(40, 29), p(40, 34), p(8, 34)], 'concrete', 'service'),
    room('Public circulation', [p(15, 0), p(48, 0), p(48, 5), p(15, 5)], 'polished-concrete', 'circulation'),
    room('East circulation', [p(40, 5), p(48, 5), p(48, 29), p(40, 29)], 'polished-concrete', 'circulation'),
  ]
  const ground = makeLevel('Competition floor', 0, outline, rooms, [
    [p(15, 0), p(15, 5)],
    [p(8, 5), p(8, 29)],
    [p(0, 11), p(8, 11)],
    [p(0, 22), p(8, 22)],
    [p(8, 29), p(40, 29)],
    [p(40, 5), p(40, 29)],
  ])
  ground.floorToFloorHeight = 10.5
  addStandardOpenings(ground)
  addInternalDoors(ground)
  ground.windows = ground.windows.filter((window) => window.wallId !== ground.walls[0].id)
  ground.doors.push({
    id: uid('door'),
    wallId: ground.walls[0].id,
    offset: 5.5,
    width: 3.2,
    height: 3.2,
    hinge: 'left',
    style: 'double',
    material: 'metal',
  })
  for (const offset of [32, 39])
    ground.windows.push({
      id: uid('window'),
      wallId: ground.walls[0].id,
      offset,
      width: 3.4,
      height: 2.4,
      sill: 1.5,
      frame: 'aluminium',
      type: 'fixed',
    })
  ground.passages!.push({ id: uid('passage'), wallId: ground.walls[0].id, offset: 20, width: 8, height: 3.5 })
  ground.seatingSections = [
    seating('West bleachers', p(13, 10), p(13, 24), p(-1, 0), 6, 20, '#456f78'),
    seating('East bleachers', p(35, 24), p(35, 10), p(1, 0), 6, 20, '#456f78'),
  ]
  ground.walls.slice(0, 4).forEach((wall) => {
    wall.height = 10.5
    wall.material = 'brick'
  })
  const splitSideWall = (wall: Wall, point: Point, firstHeight: number, secondHeight: number) => {
    const firstLength = Math.hypot(point.x - wall.start.x, point.z - wall.start.z)
    const continuation = { ...wall, id: uid('wall'), start: point, height: secondHeight }
    wall.end = point
    wall.height = firstHeight
    for (const door of ground.doors.filter((item) => item.wallId === wall.id && item.offset >= firstLength)) {
      door.wallId = continuation.id
      door.offset -= firstLength
    }
    for (const window of ground.windows.filter(
      (item) => item.wallId === wall.id && item.offset >= firstLength,
    )) {
      window.wallId = continuation.id
      window.offset -= firstLength
    }
    ground.walls.push(continuation)
  }
  ground.walls[0].height = 5.3
  ground.walls[0].material = 'plaster'
  splitSideWall(ground.walls[1], p(48, 5), 5.3, 10.5)
  splitSideWall(ground.walls[3], p(0, 5), 10.5, 5.3)
  const hallFront = createWall(p(0, 5), p(48, 5), 10.5, 0.25, 'interior')
  hallFront.material = 'brick'
  ground.walls.push(hallFront)
  for (const offset of [11, 23, 35])
    ground.passages!.push({ id: uid('passage'), wallId: hallFront.id, offset, width: 3, height: 3.1 })
  for (const offset of [9, 17, 25, 33, 41])
    ground.windows.push({
      id: uid('window'),
      wallId: hallFront.id,
      offset,
      width: 3.4,
      height: 1.8,
      sill: 6.2,
      frame: 'aluminium',
      type: 'fixed',
    })
  ground.slabs!.push(newSlab([p(0, -2), p(48, -2), p(48, 0), p(0, 0)], 0.18))
  const entryCurve = curvedWall(
    p(24, 11),
    Math.hypot(10, 15),
    Math.atan2(-15, -10),
    Math.atan2(-15, 10),
    5.8,
    0.22,
  )
  entryCurve.material = 'plaster'
  entryCurve.color = '#57747b'
  ground.walls.push(createWall(p(14, 0), entryCurve.start, 5.8, 0.22))
  ground.walls.push(entryCurve)
  ground.walls.push(createWall(entryCurve.end, p(34, 0), 5.8, 0.22))
  ground.doors.push({
    id: uid('door'),
    wallId: entryCurve.id,
    offset: 7.5,
    width: 4,
    height: 3.6,
    hinge: 'left',
    style: 'double',
    material: 'metal',
  })
  for (const offset of [1.1, 12.5])
    ground.windows.push({
      id: uid('window'),
      wallId: entryCurve.id,
      offset,
      width: 3.4,
      height: 3.4,
      sill: 0.9,
      frame: 'aluminium',
      type: 'fixed',
    })
  ground.rooms.push({
    ...room(
      'Arena reception pavilion',
      [p(14, 0), p(14, -4), p(20, -6.6), p(28, -6.6), p(34, -4), p(34, 0)],
      'marble',
      'lobby',
    ),
    id: uid('room'),
  })
  ground.slabs!.push(newSlab([p(14, 0), p(14, -4), p(20, -6.6), p(28, -6.6), p(34, -4), p(34, 0)], 0.22))
  ground.details = [
    detail('Reception entrance canopy', 'canopy', p(29, -5.7), p(19, -5.7), 4.2, 0, 2.4, 1, 'steel'),
    detail('Hall façade fins', 'fin', p(2, 5), p(46, 5), 7.5, 0, 0.6, 4, 'steel'),
    detail('West spectator guard', 'railing', p(12, 9), p(12, 25), 1.1, 4.5, 0.1, 1, 'steel'),
    detail('East spectator guard', 'railing', p(36, 25), p(36, 9), 1.1, 4.5, 0.1, 1, 'steel'),
  ]
  const galleryPlans = [
    room('West gallery', [p(8, 8), p(11, 8), p(11, 26), p(8, 26)], 'concrete', 'concourse'),
    room('East gallery', [p(37, 8), p(40, 8), p(40, 26), p(37, 26)], 'concrete', 'concourse'),
    room('North gallery', [p(11, 5), p(37, 5), p(37, 8), p(11, 8)], 'concrete', 'concourse'),
  ]
  const mezzanine: Level = {
    id: uid('level'),
    name: 'Upper spectator gallery',
    elevation: 4.5,
    floorToFloorHeight: 6,
    walls: [
      createWall(p(8, 8), p(8, 26), 1.1, 0.12, 'interior'),
      createWall(p(40, 8), p(40, 26), 1.1, 0.12, 'interior'),
    ],
    doors: [],
    windows: [],
    passages: [],
    rooms: galleryPlans.map((item) => ({ ...item, id: uid('room') })),
    slabThickness: 0.22,
    autoSlab: false,
    slabs: galleryPlans.map((item) => newSlab(item.polygon, 0.22)),
    columns: [],
    stairs: [],
    ramps: [],
    seatingSections: [],
  }
  const stairLobby = [p(1, 11), p(8, 11), p(8, 20), p(1, 20)]
  mezzanine.slabs!.push({ ...newSlab(stairLobby, 0.22), autoFromWalls: false })
  mezzanine.rooms.push({
    ...room('West gallery stair lobby', stairLobby, 'concrete', 'circulation'),
    id: uid('room'),
  })
  mezzanine.passages!.push({
    id: uid('passage'),
    wallId: mezzanine.walls[0].id,
    offset: 5.5,
    width: 3.5,
    height: 2.4,
  })
  const project = makeProject('Indoor Table-Tennis Arena', 'Eastbank Indoor Arena', [ground, mezzanine], {
    ...defaultRoof,
    shape: 'gable',
    material: 'standing-seam',
    pitch: 12,
    overhang: 0.4,
  })
  linkStair(ground, mezzanine, p(2, 13), 0, 'L')
  for (const x of [8, 24, 40])
    for (const z of [5, 31])
      ground.columns?.push({
        id: uid('column'),
        position: p(x, z),
        shape: 'rectangular',
        width: 0.55,
        depth: 0.55,
        diameter: 0.55,
        height: 10.5,
        material: 'steel',
      })
  for (const x of [2, 14, 26, 38, 46])
    ground.columns?.push({
      id: uid('column'),
      position: p(x, -1.6),
      shape: 'rectangular',
      width: 0.3,
      depth: 0.3,
      diameter: 0.3,
      height: 5.3,
      material: 'steel',
    })
  const roof: RoofSection = {
    id: uid('roof-section'),
    name: 'Main hall long-span roof',
    levelId: ground.id,
    footprint: [p(0, 5), p(48, 5), p(48, 34), p(0, 34)],
    topHeight: 10.5,
    framingSpacing: 8,
    roof: { ...defaultRoof, shape: 'gable', color: '#9fadaf', pitch: 12, overhang: 0.4 },
  }
  project.buildings[0].roofSections = [
    roof,
    {
      id: uid('roof-section'),
      name: 'Public entrance canopy',
      levelId: ground.id,
      footprint: [p(0, -2), p(48, -2), p(48, 5), p(0, 5)],
      topHeight: 5.3,
      roof: { shape: 'shed', material: 'standing-seam', color: '#a8b7b7', pitch: 5, overhang: 0.25 },
    },
    {
      id: uid('roof-section'),
      name: 'Curved reception pavilion',
      levelId: ground.id,
      footprint: [p(14, 0), p(14, -4), p(20, -6.6), p(28, -6.6), p(34, -4), p(34, 0)],
      topHeight: 5.8,
      roof: { shape: 'terrace', material: 'membrane', color: '#7d8b8b', pitch: 2, overhang: 0.22 },
    },
  ]
  return project
}
