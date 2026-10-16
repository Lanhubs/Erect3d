import {expect,test} from 'bun:test'
import {BoxGeometry,Group,InstancedMesh,Matrix4,Mesh,MeshStandardMaterial,Vector3} from 'three'
import {captureFloor,disposeCapturedFloor} from '../src/geometry/captureFloor'
import {towerValidationSample} from '../src/domain/towerValidationSample'
import {visibleSystems} from '../src/geometry/systemVisibility'
import {createSystem} from '../src/domain/createSystem'
import {facadeParts} from '../src/geometry/facadeSystem'
import {transformElement} from '../src/domain/elementEditing'
import {houseSample} from '../src/domain/residentialSamples'
import {compileSystem} from '../src/geometry/systemCompiler'

test('linked floors capture actual transforms, material regions and visible instances without disposing borrowed resources',()=>{
  const root=new Group();root.position.set(20,30,40);root.visible=false
  const geometry=new BoxGeometry(),material=new MeshStandardMaterial(),accent=new MeshStandardMaterial()
  const stair=new Mesh(geometry,material);stair.position.set(2,3,4);root.add(stair)
  const detail=new Mesh(geometry,[material,accent,material,accent,material,accent]);root.add(detail)
  const furniture=new InstancedMesh(geometry,material,2);furniture.position.x=4
  furniture.setMatrixAt(0,new Matrix4().makeTranslation(1,0,0));furniture.setMatrixAt(1,new Matrix4().makeTranslation(2,0,0));root.add(furniture)
  const hiddenProxy=new Mesh(geometry,material);hiddenProxy.visible=false;root.add(hiddenProxy)
  let borrowedDisposed=0,ownedDisposed=0
  geometry.addEventListener('dispose',()=>borrowedDisposed++);material.addEventListener('dispose',()=>borrowedDisposed++)
  const packages=captureFloor(root,31),borrowed=packages.find(p=>!p.ownedGeometry)!
  expect(borrowed.matrices).toHaveLength(3)
  expect(new Vector3().setFromMatrixPosition(borrowed.matrices[0]).toArray()).toEqual([2,3,4])
  expect(new Vector3().setFromMatrixPosition(borrowed.matrices[2]).x).toBe(6)
  const regions=packages.filter(p=>p.ownedGeometry);expect(regions).toHaveLength(6)
  for(const item of regions){expect(item.geometry.index!.count).toBe(6);item.geometry.addEventListener('dispose',()=>ownedDisposed++)}
  disposeCapturedFloor(packages);expect(ownedDisposed).toBe(6);expect(borrowedDisposed).toBe(0)
  expect(()=>captureFloor(root,300000)).toThrow('instance budget')
  furniture.dispose();geometry.dispose();material.dispose();accent.dispose()
})

test('current-level inspection slices vertical architecture, hides linked floors and leaves the full model unchanged',()=>{
  const building=towerValidationSample().buildings[0],before=JSON.stringify(building),shown=new Set([building.levels[0].id])
  const visible=visibleSystems(building,shown,true)
  expect(visible.some(s=>s.kind==='typical-floors')).toBe(false)
  expect(visible.every(s=>'height' in s&&s.height===3.6)).toBe(true)
  expect(visibleSystems(building,shown,false)).toHaveLength(3)
  expect(JSON.stringify(building)).toBe(before)
})

test('a source-bound facade preserves the actual door opening and core walls retain their authored body',()=>{
  const project=houseSample(),level=project.buildings[0].levels[0],wall=level.walls[0]
  level.doors=[{id:'entry',wallId:wall.id,offset:1,width:1,height:2.1,hinge:'left'}]
  const facade=createSystem('curtain-wall',level)
  if(facade.kind!=='curtain-wall')throw new Error('Fixture')
  facade.path=[wall.start,wall.end];facade.wallIds=[wall.id];facade.height=3
  const parts=facadeParts(facade,level),length=Math.hypot(wall.end.x-wall.start.x,wall.end.z-wall.start.z)
  const area=parts.glass.reduce((sum,p)=>sum+p.size[0]*p.size[1],0)
  expect(area).toBeCloseTo(length*3-2.1,5)
  const core=createSystem('core',level)
  if(core.kind!=='core')throw new Error('Fixture')
  core.wallIds=[wall.id];core.height=wall.height
  expect(compileSystem(core,level).parts).toHaveLength(0)
  core.height=wall.height+4
  expect(compileSystem(core,level).parts[0].size[1]).toBeCloseTo(4)
})

test('architectural transforms carry source walls, openings and fitted roofs, and support lock rejection',()=>{
  const project=houseSample(),building=project.buildings[0],level=building.levels[0],wall=level.walls[0]
  const facade=createSystem('curtain-wall',level)
  if(facade.kind!=='curtain-wall')throw new Error('Fixture')
  facade.path=[wall.start,wall.end];facade.wallIds=[wall.id]
  building.systems={version:1,typology:'house',systems:[facade]}
  const before=JSON.stringify(project),selection={kind:'architecture' as const,id:facade.id}
  const result=transformElement(project,selection,{move:{x:0,z:-1}})
  expect(result.issue).toBeNull();expect(JSON.stringify(project)).toBe(before)
  expect(result.project.buildings[0].levels[0].walls[0].start.z).toBeCloseTo(wall.start.z-1)
  const reshaped=transformElement(project,selection,{vertex:{index:0,point:{x:wall.start.x,z:wall.start.z-.2}}})
  expect(reshaped.issue).toBeNull()
  expect(reshaped.project.buildings[0].levels[0].walls[0].start.z).toBeCloseTo(wall.start.z-.2)
  expect(transformElement(project,selection,{height:-100}).project).toBe(project)
  level.locked=true
  expect(transformElement(project,selection,{move:{x:1,z:0}}).issue).toContain('Unlock')
})
