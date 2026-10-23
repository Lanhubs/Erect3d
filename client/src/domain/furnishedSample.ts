import { duplicateLevel } from './levels'
import { defaultRoof, uid } from './types'
import { p, room, makeLevel, makeProject, attachSite, linkStair } from './sampleHelpers'
import { estimatedVariant, newFurniture } from '../furniture/entities'
import type { FurnitureType } from '../furniture/types'
export function furnishedHouseSample() {
  const ground = makeLevel(
    'Ground floor',
    0,
    [p(0, 0), p(12, 0), p(12, 10), p(0, 10)],
    [
      room('Living / dining', [p(0, 0), p(5, 0), p(5, 6), p(0, 6)], 'oak', 'living'),
      room('Kitchen', [p(7, 0), p(12, 0), p(12, 4), p(7, 4)], 'tile', 'kitchen'),
      room('Bathroom', [p(7, 4), p(12, 4), p(12, 6), p(7, 6)], 'porcelain-tile', 'bathroom'),
      room('Bedroom 01', [p(0, 6), p(5, 6), p(5, 10), p(0, 10)], 'oak', 'bedroom'),
      room('Bedroom 02', [p(7, 6), p(12, 6), p(12, 10), p(7, 10)], 'oak', 'bedroom'),
      room('Stair hall', [p(5, 0), p(7, 0), p(7, 10), p(5, 10)], 'polished-concrete', 'circulation'),
    ],
    [
      [p(5, 0), p(5, 10)],
      [p(7, 0), p(7, 10)],
      [p(0, 6), p(5, 6)],
      [p(7, 4), p(12, 4)],
      [p(7, 6), p(12, 6)],
    ],
  )
  ground.walls.forEach((wall) => {
    wall.height = 2.98
  })
  ground.doors = [
    {
      id: uid('door'),
      wallId: ground.walls[2].id,
      offset: 5.4,
      width: 1.2,
      height: 2.2,
      hinge: 'left',
      style: 'glazed',
    },
    ...[
      [4, 1.3],
      [4, 8.7],
      [5, 1.3],
      [5, 4.65],
      [5, 8.7],
    ].map(([wall, offset]) => ({
      id: uid('door'),
      wallId: ground.walls[wall].id,
      offset,
      width: 0.9,
      height: 2.1,
      hinge: 'left' as const,
    })),
  ]
  ground.windows = [
    [0, 1.5],
    [0, 8.5],
    [1, 6.7],
    [3, 1.5],
  ].map(([wall, offset]) => ({
    id: uid('window'),
    wallId: ground.walls[wall].id,
    offset,
    width: 1.6,
    height: 1.3,
    sill: 0.9,
  }))
  const place = (type: FurnitureType, x: number, z: number, rotation = 0, width?: number) => {
    const object = newFurniture(ground, type, p(x, z))
    object.rotation = rotation
    if (width) object.width = width
    object.assetId = estimatedVariant(type, object.width)
    object.roomId = ground.rooms.find(
      (room) =>
        x > Math.min(...room.polygon.map((p) => p.x)) &&
        x < Math.max(...room.polygon.map((p) => p.x)) &&
        z > Math.min(...room.polygon.map((p) => p.z)) &&
        z < Math.max(...room.polygon.map((p) => p.z)),
    )?.id
    ground.furniture ||= []
    ground.furniture.push(object)
  }
  place('sofa', 1.05, 2.2, 90)
  place('coffee-table', 2.6, 2.2)
  place('dining-table', 3.2, 4.5)
  for (const x of [2.7, 3.7]) for (const z of [3.55, 5.4]) place('dining-chair', x, z, z < 4 ? 180 : 0)
  place('bed', 2.2, 8, 0, 1.6)
  place('bedside-table', 3.4, 7.2)
  place('wardrobe', 1.5, 9.45)
  place('bed', 10, 8, 0, 1.6)
  place('desk', 8, 9.45)
  place('kitchen-cabinet', 9, 0.5, 0, 2.6)
  place('refrigerator', 11.3, 0.6)
  place('kitchen-island', 10, 2.6)
  place('toilet', 8.4, 5.3)
  place('bathroom-sink', 9.5, 4.5)
  place('shower', 11.3, 5.3)
  const upper = duplicateLevel(ground, 'Upper residence', 3.2)
  linkStair(ground, upper, p(6, 8), 270, 'straight')
  const project = makeProject('Maple House · furnished walkthrough', 'Maple House', [ground, upper], {
    ...defaultRoof,
    shape: 'hip',
  })
  attachSite(project)
  return project
}
