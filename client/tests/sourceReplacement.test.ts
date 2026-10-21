import {expect,test} from 'bun:test'
import {fixtureProject} from '../src/domain/fixture'
import {blankLevel} from '../src/domain/levels'
import {hasLevelGeometry,replaceSource} from '../src/domain/replaceSource'
import type {SourceDocument} from '../src/domain/types'
import {useProject} from '../src/state/project'
import {replaceProjectSource} from '../src/state/database'
import {setCloudPersistence} from '../src/state/persistenceMode'

const source=(id:string):SourceDocument=>({id,name:`${id}.png`,mime:'image/png',width:507,height:370,originalBytes:128106})
function setup(){
  const project=fixtureProject('Replace plan'),building=project.buildings[0],level=building.levels[0]
  level.sourceId='old';project.sources=[source('old')]
  level.furniture=[{id:'old-bed',levelId:level.id,type:'bed',position:{x:99,z:99},width:2,depth:2,height:1,rotation:0,assetId:'bed',materialOverrides:{finish:'fabric',color:'#ddd'}}]
  level.details=[{id:'old-canopy',name:'Canopy',kind:'canopy',start:{x:0,z:0},end:{x:2,z:0},baseElevation:3,height:.2,depth:1,spacing:1,material:'steel'}]
  level.stairGuides=[{id:'old-guide',polygon:[{x:0,z:0},{x:1,z:0},{x:1,z:2}],evidence:'Plan stair'}]
  building.roofSections=[{id:'old-roof',name:'Roof',levelId:level.id,footprint:level.rooms[0].polygon,roof:level.roof!}]
  building.systems={version:1,typology:'house',systems:[{id:'old-beam',name:'Beam',kind:'beam',levelId:level.id,origin:'detected',evidence:'Plan',color:'#888',elevation:3,start:{x:0,z:0},end:{x:2,z:0},width:.2,height:.3}]}
  project.interpretation={'old-bed':{origin:'detected',sourceId:'old',confirmedFields:[]}}
  return {project,building,level}
}

test('replacing a source clears its complete model rather than leaving orphaned furniture and roofs',()=>{
  const {project,building,level}=setup(),before=structuredClone(project)
  const {project:next}=replaceSource(project,source('new'),level.id),floor=next.buildings[0].levels[0]
  expect(hasLevelGeometry(floor)).toBe(false)
  expect(next.buildings[0].roofSections).toEqual([]);expect(next.buildings[0].systems?.systems).toEqual([])
  expect(next.interpretation).toEqual({});expect(floor.roof).toEqual(building.levels[0].roof)
  expect(floor.sourceId).toBe('new');expect(floor.calibration?.method).toBe('auto')
  expect(next.sources.map(item=>item.id)).toEqual(['new']);expect(project).toEqual(before)
})

test('replacement keeps other floors and shared source images, removing only stair connections to the replaced floor',()=>{
  const {project,building,level}=setup(),upper=blankLevel('First floor',3,3),unrelated=blankLevel('Second floor',6,3)
  upper.sourceId='old';upper.furniture=structuredClone(level.furniture);upper.furniture![0].id='upper-bed'
  upper.slabs=[{id:'upper-slab',polygon:level.rooms[0].polygon,thickness:.2,elevation:0,structuralMaterial:'concrete',finishMaterial:'tile',openings:[
    {id:'stair-cut',kind:'stair',polygon:level.rooms[0].polygon},{id:'shaft-cut',kind:'shaft',polygon:level.rooms[1].polygon}]}]
  level.stairs=[{id:'connection',fromLevelId:level.id,toLevelId:upper.id,openingId:'stair-cut',start:{x:0,z:0},direction:0,form:'straight',width:1,riserHeight:.17,treadDepth:.28,landingLength:1}]
  building.levels.push(upper,unrelated)
  const {project:next}=replaceSource(project,source('new'),level.id),floors=next.buildings[0].levels
  expect(floors[1].furniture).toEqual(upper.furniture);expect(floors[2]).toEqual(unrelated)
  expect(floors[1].slabs![0].openings.map(item=>item.id)).toEqual(['shaft-cut'])
  expect(next.sources.map(item=>item.id)).toEqual(['old','new'])
})

test('furniture-only floors still require a replacement confirmation',()=>{
  const {level}=setup();level.walls=[];level.doors=[];level.windows=[];level.rooms=[];level.details=[];level.stairGuides=[]
  expect(hasLevelGeometry(level)).toBe(true)
})

test('roof-only and system-only source models also require confirmation',()=>{
  const {level,building}=setup()
  for(const key of ['walls','doors','windows','rooms','furniture','details','stairGuides'] as const)level[key]=[]
  expect(hasLevelGeometry(level)).toBe(false);expect(hasLevelGeometry(level,building)).toBe(true)
  building.roofSections=[];expect(hasLevelGeometry(level,building)).toBe(true)
})

test('a first import on a manually designed floor does not discard it or another floor’s source',()=>{
  const {project,building,level}=setup(),upper=blankLevel('First floor',3,3)
  level.sourceId=undefined;upper.sourceId='old';building.levels.push(upper)
  const {project:next}=replaceSource(project,source('new'),level.id)
  expect(next.buildings[0].levels[0].walls).toEqual(level.walls)
  expect(next.sources.map(item=>item.id)).toEqual(['old','new'])
})

test('replacement clears the stale inspector selection and is one undoable editor action',()=>{
  const {project,level}=setup(),store=useProject.getState()
  store.setReadOnly(false);store.setProject(project);store.setSelection({kind:'furniture',id:'old-bed'});store.setTool('wall')
  const before=structuredClone(useProject.getState().project!)
  store.replaceDocument(replaceSource(before,source('new'),level.id).project)
  expect(useProject.getState().selection).toBeNull();expect(useProject.getState().tool).toBe('select')
  expect(hasLevelGeometry(useProject.getState().project!.buildings[0].levels[0])).toBe(false)
  store.undo();expect(useProject.getState().project).toEqual(before)
  store.redo();expect(useProject.getState().project!.buildings[0].levels[0].furniture).toEqual([])
  store.setProject(null)
})

test('cloud persistence stages a complete replacement only after the unchanged source bytes are cached',async()=>{
  const {project,level}=setup(),blob=new Blob(['original lossless file']),calls:string[]=[]
  setCloudPersistence({projectId:project.id,loadSource:async()=>undefined,
    saveSource:async(id,file)=>{expect(await file.text()).toBe('original lossless file');calls.push(id)},
    save:async next=>{expect(hasLevelGeometry(next.buildings[0].levels[0])).toBe(false);calls.push('document')}})
  try{await replaceProjectSource(project,source('new'),blob,undefined,level.id);expect(calls).toEqual(['new','document'])}
  finally{setCloudPersistence()}
})
