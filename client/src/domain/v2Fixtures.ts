import { fixtureProject } from './fixture'
import { duplicateLevel, newSlab, wallEnvelope } from './levels'
import { uid, type Project, type Stair } from './types'
import { stairOpening } from '../geometry/stairs'

export function twoStoreyHouse(): Project {
  const project = fixtureProject('Two-storey house')
  const ground = project.buildings[0].levels[0]
  ground.floorToFloorHeight = 3.2
  ground.slabs = [newSlab(wallEnvelope(ground), .22)]
  const upper = duplicateLevel(ground, 'Level 01', 3.2)
  upper.floorToFloorHeight = 3.1
  upper.rooms[0].material = 'porcelain-tile'
  upper.rooms[1].material = 'timber'
  project.buildings[0].levels.push(upper)
  return project
}

export function threeStoreyBuilding(): Project {
  const project = twoStoreyHouse()
  const level = duplicateLevel(project.buildings[0].levels[1], 'Level 02', 6.3)
  level.floorToFloorHeight = 3.4
  project.buildings[0].levels.push(level)
  return project
}

export function atriumBuilding(): Project {
  const project = twoStoreyHouse()
  const upper = project.buildings[0].levels[1]
  upper.slabs![0].openings.push({ id: uid('opening'), kind: 'void', polygon: [
    { x: 2, z: 2 }, { x: 4, z: 2 }, { x: 4, z: 6 }, { x: 2, z: 6 },
  ] })
  return project
}

export function stairBuilding(): Project {
  const project = twoStoreyHouse()
  const [ground, upper] = project.buildings[0].levels
  const stair: Stair = { id: uid('stair'), fromLevelId: ground.id, toLevelId: upper.id,
    start: { x: 1.2, z: 1.2 }, direction: 0, form: 'straight', width: 1.1,
    riserHeight: .18, treadDepth: .28, landingLength: 1.1, openingId: uid('opening') }
  ground.stairs = [stair]
  upper.slabs![0].openings.push({ id: stair.openingId!, kind: 'stair', polygon: stairOpening(stair, project.buildings[0].levels) })
  return project
}
