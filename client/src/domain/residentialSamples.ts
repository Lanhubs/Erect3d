import { duplicateLevel, newSlab } from './levels'
import { defaultRoof, uid, type Project } from './types'
import { p, room, makeLevel, makeProject, addStandardOpenings, addInternalDoors, curvedWall, attachSite, addRoofSections, linkStair, detail } from './sampleHelpers'

export function houseSample(): Project {
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
  level.details = [detail('Entrance porch', 'canopy', p(8, 0), p(4, 0), 2.75, 0, 1.5, 1, 'timber'),
    detail('Porch screen', 'fin', p(0, 0), p(3, 0), 2.7, 0, .32, .45, 'timber')]
  const project = makeProject('Willow Court House', 'Willow Court House', [level], { ...defaultRoof, shape: 'gable', pitch: 28 })
  attachSite(project)
  return project
}

export function villaSample(): Project {
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
  ground.details = [detail('Garden veranda pergola', 'pergola', p(-1.8, .2), p(-1.8, 7.8), 3.05, 0, 2.2, .7, 'timber'),
    detail('Veranda balustrade', 'railing', p(-2, .2), p(-2, 7.8), 1.05, .18, .1, .85, 'steel'),
    detail('Gallery screen', 'screen', p(0, 9), p(7.8, 9), 2.8, 0, .18, .42, 'timber')]
  const upper = duplicateLevel(ground, 'Upper residence', 3.4)
  upper.floorToFloorHeight = 3.1
  upper.rooms = [room('Lounge', [p(0, 0), p(9, 0), p(9, 8), p(0, 8)], 'oak', 'living'),
    room('Suite', [p(9, 0), p(18, 0), p(18, 8), p(9, 8)], 'timber', 'bedroom')].map(item => ({ ...item, id: uid('room') }))
  upper.details = [detail('Upper terrace railing', 'railing', p(0, 0), p(11, 0), 1.1, .18, .1, .9, 'steel'),
    detail('Upper garden screen', 'fin', p(11, 12), p(11, 16.5), 2.6, 0, .35, .65, 'timber')]
  const project = makeProject('Juniper Ridge Villa', 'Juniper Ridge Villa', [ground, upper], { ...defaultRoof, shape: 'hip', pitch: 22 })
  project.buildings[0].levels = [ground, upper]
  addRoofSections(project.buildings[0], upper)
  attachSite(project, 7)
  return project
}

export function apartmentSample(): Project {
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
    const edge = index % 2 ? [p(27, 3), p(27, 9)] : [p(-3, 9), p(-3, 3)]
    level.details = [detail('Apartment balcony rail', 'railing', edge[0], edge[1], 1.05, .18, .1, .8, 'steel'),
      detail('Lobby façade fins', 'fin', p(1, 0), p(5, 0), 2.5, 0, .28, .7, 'steel')]
  }
  const project = makeProject('Meridian Apartments', 'Meridian Apartments', [ground, second, third], { ...defaultRoof, shape: 'hidden', material: 'concrete' })
  return project
}

