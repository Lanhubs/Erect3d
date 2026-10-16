import {expect,test} from 'bun:test'
import {towerValidationSample} from '../src/domain/towerValidationSample'
import {floorPages} from '../src/domain/floorRepetition'
import {linkedFloorIndices,detachTypicalFloor} from '../src/domain/typicalFloors'
import {createRoofGeometryCache} from '../src/domain/roofGeometryCache'
import {validateSystems} from '../src/domain/systemValidation'
import {projectSchema} from '../../api/src/contracts/project'
import {buildingLight} from '../src/geometry/buildingLight'

test('256 storeys persist as one template with stable floor identities across render pages',()=>{
  const project=towerValidationSample(256),building=project.buildings[0]
  const group=building.systems!.systems.find(s=>s.kind==='typical-floors')!
  expect(projectSchema.safeParse(project).success).toBe(true);expect(validateSystems(building)).toEqual([])
  expect(building.levels).toHaveLength(1)
  const indices=linkedFloorIndices(building,group),pages=floorPages(indices)
  expect(pages.map(p=>p.length)).toEqual([63,64,64,64]);expect(pages.flat()).toEqual(indices)
  const detached=detachTypicalFloor(project,building.id,group.id,240)
  expect(detached.buildings[0].levels[1].elevation).toBeCloseTo(864)
  expect(building.levels).toHaveLength(1)
})
test('automatic crowns move to the repeated top floor and update when the group changes',()=>{
  const building=towerValidationSample(256).buildings[0],level=building.levels[0]
  building.roofSections=[];level.autoRoof=true
  const cached=createRoofGeometryCache(),sections=cached(building)
  expect(sections.length).toBeGreaterThan(0);expect(sections[0].topHeight).toBeCloseTo(921.6)
  const systems={...building.systems!,systems:building.systems!.systems.map(s=>s.kind==='typical-floors'?{...s,count:300}:s)}
  expect(cached({...building,systems})[0].topHeight).toBeCloseTo(1080)
  expect(sections[0].topHeight).toBeCloseTo(921.6)
})
test('the same sun direction and complete shadow coverage are retained from a house to a tall tower',()=>{
 for(const top of [3,115.2,921.6]){
  const rig=buildingLight({minX:0,maxX:36,minZ:0,maxZ:28,bottom:0,top})
  expect(rig.position[1]).toBeGreaterThan(top)
  for(const point of rig.points){
   const p=point.clone().applyMatrix4(rig.view)
   expect(p.x).toBeGreaterThan(rig.left);expect(p.x).toBeLessThan(rig.right)
   expect(p.y).toBeGreaterThan(rig.bottom);expect(p.y).toBeLessThan(rig.top)
   expect(-p.z).toBeGreaterThan(rig.near);expect(-p.z).toBeLessThan(rig.far)
  }
 }
})
