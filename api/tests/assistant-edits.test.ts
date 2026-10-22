import {expect,test} from 'bun:test'
import {EditWorkspace} from '../src/modules/assistant/edits'
import {executeTool} from '../src/modules/assistant/tools'
import {fixture} from './helpers'
import {houseSample} from '../../client/src/domain/residentialSamples'
import {towerValidationSample} from '../../client/src/domain/towerValidationSample'
import {blankLevel} from '../../client/src/domain/levels'
import {effectiveRoofSections} from '../../client/src/domain/roofCoverage'
import type {Project} from '../src/contracts/project'
function work(project:Project,mode:'selection'|'level'|'building'='level',entityId?:string,floorIndex?:number){const b=project.buildings[0],l=b.levels[0];return new EditWorkspace(project,{mode,buildingId:b.id,levelId:l.id,entityId,floorIndex})}
test('selected door edits keep host, IDs and the source untouched; another wall is outside scope',()=>{
  const p=fixture(),l=p.buildings[0].levels[0],w=l.walls[0]
  l.doors=[{id:'entrance',wallId:w.id,offset:1,width:.9,height:2.1,hinge:'left'}]
  const e=work(p,'selection','entrance')
  e.apply({action:'set',kind:'door',id:'entrance',properties:JSON.stringify({style:'glazed',material:'metal'})})
  expect(e.proposal().document.buildings[0].levels[0].doors[0]).toMatchObject({id:'entrance',wallId:w.id,style:'glazed'})
  expect(l.doors[0].style).toBeUndefined()
  expect(()=>e.apply({action:'set',kind:'door',id:'entrance',properties:'{"id":"entrance","style":"panel"}'})).not.toThrow()
  expect(()=>e.apply({action:'set',kind:'door',id:'entrance',properties:'{"id":"changed-id"}'})).toThrow('IDs')
  expect(()=>e.apply({action:'set',kind:'wall',id:w.id,properties:'{"height":4}'})).toThrow('wider scope')
})
test('named rooms, material and roof changes use existing schemas and rollback a failed tool batch',()=>{
  const p=houseSample(),e=work(p),b=p.buildings[0],l=b.levels[0],r=l.rooms[0]
  expect((executeTool(e,'find_elements',{query:r.name}) as any).total).toBeGreaterThan(0)
  e.apply({action:'set',kind:'room',id:r.id,properties:'{"material":"timber"}'})
  e.apply({action:'set',kind:'roof',id:l.id,properties:'{"shape":"terrace","pitch":0,"material":"membrane"}'})
  const before=JSON.stringify(e.document)
  expect(()=>executeTool(e,'edit_model',{commands:[{action:'set',kind:'room',id:r.id,properties:'{"name":"Changed"}'},{action:'set',kind:'wall',id:'missing',properties:'{"height":4}'}]})).toThrow()
  expect(JSON.stringify(e.document)).toBe(before)
  expect(e.proposal().changes.length).toBeGreaterThan(0)
  expect(effectiveRoofSections(e.document.buildings[0]).filter(s=>s.levelId===l.id).every(s=>s.roof.shape==='terrace')).toBe(true)
})
test('crossing footprints, source changes and locked levels are refused',()=>{
  const p=houseSample(),e=work(p),l=p.buildings[0].levels[0]
  e.apply({action:'set',kind:'room',id:l.rooms[0].id,properties:JSON.stringify({polygon:[{x:0,z:0},{x:4,z:4},{x:0,z:4},{x:4,z:0}]})})
  expect(()=>e.proposal()).toThrow('crossings')
  expect(()=>work(p).apply({action:'set',kind:'level',id:l.id,properties:'{"sourceId":"anything"}'})).toThrow('semantic')
  l.locked=true;expect(()=>work(p).apply({action:'set',kind:'room',id:l.rooms[0].id,properties:'{"name":"Changed"}'})).toThrow('Unlock')
})
test('an individual linked storey detaches with new IDs and leaves the template and other storeys intact',()=>{
  const p=towerValidationSample(8),b=p.buildings[0],group=b.systems!.systems.find(s=>s.kind==='typical-floors')!,e=work(p,'selection',group.id,3)
  expect(()=>e.apply({action:'set',kind:'system',id:group.id,properties:'{"count":2}'})).toThrow('Detach')
  expect(()=>e.apply({action:'detach-floor',id:group.id,index:2})).toThrow('selected floor')
  const detached=e.apply({action:'detach-floor',id:group.id,index:3}) as any
  e.apply({action:'set',kind:'room',id:detached.rooms[0].id,properties:'{"name":"Private studio"}'})
  const proposal=e.proposal(),owner=proposal.document.buildings[0]
  expect(owner.levels[0]).toEqual(b.levels[0]);expect(owner.levels.at(-1)!.elevation).toBeCloseTo(10.8)
  expect(owner.levels.at(-1)!.rooms[0].name).toBe('Private studio')
  expect((owner.systems!.systems[0] as any).count).toBe(8)
})
test('furniture additions are typed and connected stairs reserve a real upper slab opening',()=>{
  const p=fixture(),l=p.buildings[0].levels[0],upper=blankLevel('First floor',3,3)
  l.walls=[];p.buildings[0].levels.push(upper)
  const slab={id:'upper-slab',polygon:[{x:-10,z:-10},{x:15,z:-10},{x:15,z:15},{x:-10,z:15}],thickness:.2,elevation:0,structuralMaterial:'concrete' as const,finishMaterial:'tile' as const,openings:[]}
  upper.slabs=[slab];l.slabs=[{...structuredClone(slab),id:'lower-slab'}];l.rooms=[{id:'hall',name:'Stair hall',material:'tile',polygon:slab.polygon}];const e=work(p,'building')
  e.apply({action:'create',kind:'furniture',levelId:l.id,properties:JSON.stringify({type:'sofa',assetId:'sofa',position:{x:1,z:1},rotation:0,width:2,depth:.9,height:.8})})
  e.apply({action:'connect-stair',levelId:l.id,toLevelId:upper.id,form:'straight',start:{x:0,z:0}})
  const proposal=e.proposal().document.buildings[0]
  expect(proposal.levels[0].furniture![0].levelId).toBe(l.id)
  expect(proposal.levels[1].slabs![0].openings[0].id).toBe(proposal.levels[0].stairs![0].openingId!)
})
