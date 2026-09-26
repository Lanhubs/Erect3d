import { defaultRoof, uid, type Level, type Point, type Project, type Wall } from './types'

const p = (x: number, z: number): Point => ({ x, z })
const wall = (id: string, a: Point, b: Point, thickness = .2): Wall => ({ id, start: a, end: b, thickness, height: 2.9, material: 'plaster' })

export function fixtureProject(name = 'Courtyard residence'): Project {
  const walls = [
    wall(uid('wall'), p(0, 0), p(12, 0), .28), wall(uid('wall'), p(12, 0), p(12, 8), .28),
    wall(uid('wall'), p(12, 8), p(0, 8), .28), wall(uid('wall'), p(0, 8), p(0, 0), .28),
    wall(uid('wall'), p(5, 0), p(5, 8)), wall(uid('wall'), p(5, 4), p(12, 4)),
    wall(uid('wall'), p(8.5, 4), p(8.5, 8)),
  ]
  const level: Level = {
    id: uid('level'), name: 'Ground floor', elevation: 0, walls,
    doors: [
      { id: uid('door'), wallId: walls[2].id, offset: 2.1, width: 1.1, height: 2.2, hinge: 'left' },
      { id: uid('door'), wallId: walls[4].id, offset: 2.4, width: .9, height: 2.1, hinge: 'right' },
      { id: uid('door'), wallId: walls[5].id, offset: 1.5, width: .85, height: 2.1, hinge: 'left' },
      { id: uid('door'), wallId: walls[6].id, offset: 1.2, width: .82, height: 2.1, hinge: 'right' },
    ],
    windows: [
      { id: uid('window'), wallId: walls[3].id, offset: 2, width: 2.1, height: 1.35, sill: .85 },
      { id: uid('window'), wallId: walls[0].id, offset: 2.1, width: 1.9, height: 1.3, sill: .9 },
      { id: uid('window'), wallId: walls[1].id, offset: 1.1, width: 1.8, height: 1.3, sill: .9 },
    ],
    rooms: [
      { id: uid('room'), name: 'Living / dining', polygon: [p(0, 0), p(5, 0), p(5, 8), p(0, 8)], material: 'oak' },
      { id: uid('room'), name: 'Kitchen', polygon: [p(5, 0), p(12, 0), p(12, 4), p(5, 4)], material: 'tile' },
      { id: uid('room'), name: 'Bedroom', polygon: [p(5, 4), p(8.5, 4), p(8.5, 8), p(5, 8)], material: 'oak' },
      { id: uid('room'), name: 'Study', polygon: [p(8.5, 4), p(12, 4), p(12, 8), p(8.5, 8)], material: 'timber' },
    ], slabThickness: .22, roof: { ...defaultRoof },
  }
  return { id: uid('project'), name, modified: Date.now(), buildings: [{ id: uid('building'), name, levels: [level] }], sources: [], units: 'm' }
}
