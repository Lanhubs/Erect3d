import { duplicateLevel } from './levels'
import { defaultRoof, uid, type Column, type Project } from './types'
import { p, room, makeLevel, makeProject, addStandardOpenings, addInternalDoors, curvedWall, addRoofSections, linkStair, detail } from './sampleHelpers'

export function officeSample(): Project {
  const outline = [p(0, 0), p(32, 0), p(32, 22), p(0, 22)]
  const rooms = [room('Reception', [p(0, 0), p(10, 0), p(10, 7), p(0, 7)], 'polished-concrete', 'lobby'),
    room('Open office · west', [p(0, 7), p(14, 7), p(14, 22), p(0, 22)], 'carpet', 'office'),
    room('Meeting suite', [p(14, 0), p(32, 0), p(32, 7), p(14, 7)], 'oak', 'meeting'),
    room('Open office · east', [p(14, 7), p(32, 7), p(32, 22), p(14, 22)], 'carpet', 'office')]
  const level = makeLevel('Office floor', 0, outline, rooms, [[p(10, 0), p(10, 7)], [p(14, 0), p(14, 22)], [p(0, 7), p(32, 7)]])
  addStandardOpenings(level); addInternalDoors(level)
  level.details = [detail('Lobby entrance canopy', 'canopy', p(12, 0), p(2, 0), 3.2, 0, 2.6, 1, 'steel'),
    detail('Commercial façade fins', 'fin', p(16, 0), p(31, 0), 3.3, 0, .45, 1.4, 'steel')]
  for (const x of [8, 16, 24]) for (const z of [5, 11, 17]) {
    const column: Column = { id: uid('column'), position: p(x, z), shape: 'circular', width: .45, depth: .45, diameter: .45, height: 3.4, material: 'steel' }
    level.columns?.push(column)
  }
  const level1 = duplicateLevel(level, 'Level 01', 3.4)
  level1.details = [detail('Upper façade fins', 'fin', p(0, 0), p(31, 0), 3.1, 0, .38, 1.5, 'steel')]
  linkStair(level, level1, p(2, 9), 0, 'U')
  const project = makeProject('Northline Studio Offices', 'Northline Studio', [level, level1], { ...defaultRoof, shape: 'hidden', material: 'standing-seam' })
  addRoofSections(project.buildings[0], level1, ['standing-seam', 'concrete'])
  return project
}

export function mallSample(): Project {
  const outline = [p(0, 0), p(32, 0), p(32, 10), p(25, 10), p(25, 24), p(7, 24), p(7, 10), p(0, 10)]
  const rooms = [room('Central atrium', [p(12, 8), p(20, 8), p(20, 17), p(12, 17)], 'porcelain-tile', 'atrium'),
    room('West retail wing', [p(0, 0), p(12, 0), p(12, 24), p(7, 24), p(7, 10), p(0, 10)], 'tile', 'retail'),
    room('East retail wing', [p(20, 0), p(32, 0), p(32, 10), p(25, 10), p(25, 24), p(20, 24)], 'tile', 'retail'),
    room('Food hall', [p(12, 17), p(20, 17), p(20, 24), p(12, 24)], 'polished-concrete', 'food hall'),
    room('Main concourse', [p(12, 0), p(20, 0), p(20, 8), p(12, 8)], 'marble', 'circulation')]
  const ground = makeLevel('Concourse', 0, outline, rooms, [[p(12, 0), p(12, 8)], [p(20, 0), p(20, 8)], [p(12, 17), p(20, 17)]])
  ground.slabs![0].openings.push({ id: uid('opening'), kind: 'void', polygon: [p(12, 8), p(20, 8), p(20, 17), p(12, 17)] })
  addStandardOpenings(ground); addInternalDoors(ground)
  ground.details = [detail('Mall entrance canopy', 'canopy', p(22, 0), p(10, 0), 4.6, 0, 2.8, 1, 'glass'),
    detail('West shopfront rhythm', 'fin', p(1, 0), p(11, 0), 4.4, 0, .28, 1.3, 'steel'),
    detail('East shopfront rhythm', 'fin', p(21, 0), p(31, 0), 4.4, 0, .28, 1.3, 'steel')]
  const upper = duplicateLevel(ground, 'Upper gallery', 5.2)
  upper.slabs![0].openings.push({ id: uid('opening'), kind: 'void', polygon: [p(12, 8), p(20, 8), p(20, 17), p(12, 17)] })
  upper.rooms = [room('Upper west shops', [p(7, 0), p(12, 0), p(12, 24), p(7, 24)], 'tile', 'retail'),
    room('Upper east shops', [p(20, 0), p(25, 0), p(25, 24), p(20, 24)], 'tile', 'retail')].map(item => ({ ...item, id: uid('room') }))
  upper.details = [detail('West atrium guardrail', 'railing', p(12, 8), p(12, 17), 1.1, .22, .1, 1, 'steel'),
    detail('East atrium guardrail', 'railing', p(20, 17), p(20, 8), 1.1, .22, .1, 1, 'steel')]
  linkStair(ground, upper, p(9.5, 2), 90, 'U')
  linkStair(ground, upper, p(22, 12), 0, 'L')
  const project = makeProject('Central Walk Mall', 'Central Walk', [ground, upper], { ...defaultRoof, shape: 'hidden', material: 'standing-seam' })
  addRoofSections(project.buildings[0], upper, ['standing-seam', 'concrete-tile', 'concrete', 'standing-seam'])
  return project
}

export function publicBuildingSample(): Project {
  const outline = [p(0, 2), p(14, 0), p(23, 6), p(20, 19), p(11, 24), p(0, 18)]
  const rooms = [room('Forum hall', [p(5, 5), p(17, 5), p(17, 15), p(5, 15)], 'polished-concrete', 'hall'),
    room('Community room', [p(0, 2), p(5, 5), p(5, 15), p(0, 18)], 'tile', 'community'),
    room('Library wing', [p(17, 5), p(23, 6), p(20, 19), p(17, 15)], 'oak', 'library'),
    room('Civic gallery', [p(5, 15), p(17, 15), p(11, 24), p(0, 18)], 'marble', 'gallery')]
  const ground = makeLevel('Public level', 0, outline, rooms, [[p(5, 5), p(5, 15)], [p(17, 5), p(17, 15)], [p(5, 15), p(17, 15)]])
  ground.walls.push(curvedWall(p(11, 10), 3.6, Math.PI, Math.PI * 2, 5.5, .2))
  addStandardOpenings(ground); addInternalDoors(ground)
  ground.details = [detail('Forum entrance canopy', 'canopy', p(13, 1), p(5, 1), 4.5, 0, 2.4, 1, 'steel'),
    detail('Civic screen', 'screen', p(17, 5), p(21, 7), 4.6, 0, .28, .7, 'timber')]
  ground.ramps?.push({ id: uid('ramp'), start: p(1, 18), end: p(8, 21), width: 1.8, thickness: .16,
    startElevation: 0, endElevation: .9, material: 'reinforced-concrete' })
  const upper = duplicateLevel(ground, 'Upper gallery', 5.5)
  upper.rooms = [room('Exhibition hall', [p(2, 3), p(19, 4), p(18, 18), p(3, 19)], 'concrete', 'exhibition')]
    .map(item => ({ ...item, id: uid('room') }))
  upper.details = [detail('Gallery parapet', 'parapet', p(3, 19), p(11, 24), 1.2, .2, .26, 1, 'concrete')]
  linkStair(ground, upper, p(7, 7), 45, 'L')
  const project = makeProject('Harbor Civic Forum', 'Harbor Civic Forum', [ground, upper], { ...defaultRoof, shape: 'shed', pitch: 10 })
  addRoofSections(project.buildings[0], upper)
  return project
}

