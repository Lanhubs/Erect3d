import {expect,test} from 'bun:test'
import {fixtureProject} from '../src/domain/fixture'
import {levelWithSystemVoids} from '../src/geometry/systemVoidSlabs'
test('prepared slabs retain identity across unrelated floor edits and rebuild shaft openings when elevations change',()=>{
  const building=fixtureProject().buildings[0],level=building.levels[0]
  level.slabs=[{id:'deck',polygon:[{x:0,z:0},{x:12,z:0},{x:12,z:8},{x:0,z:8}],thickness:.2,elevation:0,structuralMaterial:'concrete',finishMaterial:'concrete',openings:[]}]
  building.systems={version:1,typology:'office',systems:[{id:'shaft',name:'Lift shaft',kind:'shaft',levelId:level.id,origin:'user-selected',evidence:'Authored',color:'#aaa',elevation:0,height:8,thickness:.2,polygon:[{x:2,z:2},{x:3,z:2},{x:3,z:3},{x:2,z:3}]}]}
  const prepared=levelWithSystemVoids(level,building)
  expect(prepared.slabs?.[0].openings).toHaveLength(1)
  building.levels=[level,{...structuredClone(level),id:'upper',elevation:4}]
  const withUpper=levelWithSystemVoids(level,building)
  expect(levelWithSystemVoids(level,{...building,levels:[level,{...building.levels[1],name:'Renamed office'}]})).toBe(withUpper)
  const relocated={...level,id:'upper',elevation:12},outside=levelWithSystemVoids(relocated,{...building,levels:[level,relocated]})
  expect(outside).toBe(relocated);expect(outside.slabs?.[0].openings).toHaveLength(0)
  expect(level.slabs[0].openings).toHaveLength(0)
})
