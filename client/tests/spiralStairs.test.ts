import {expect,test} from 'bun:test'
import {Mesh,MeshBasicMaterial,DoubleSide,Raycaster,Vector3} from 'three'
import type {SpiralStairSystem} from '../src/domain/buildingSystems'
import {spiralStairPlan,spiralTreadGeometry} from '../src/geometry/spiralStair'
import {architecturalQualitySample} from '../src/domain/buildingValidationSamples'
import {validateSystems} from '../src/domain/systemValidation'
import {visibleSystems} from '../src/geometry/systemVisibility'
import {levelWithSystemVoids} from '../src/geometry/systemVoidSlabs'
import {buildWalkSurfaces,floorAt,headBlocked} from '../src/walkthrough/grounding'
import {buildWalkObstacles,blockedAt} from '../src/walkthrough/collision'
import {duplicateLevel} from '../src/domain/levels'
const stair:SpiralStairSystem={id:'spiral',name:'Source spiral fire escape',kind:'spiral-stair',levelId:'ground',origin:'detected',evidence:'Source circular stair and section',elevation:0,color:'#6f7a7e',center:{x:6,z:4},radius:1.5,width:1.15,height:6.4,riserHeight:.17,turnHeight:3.2,rotation:25,clockwise:true,material:'metal'}
test('spiral stairs emit actual indexed annular treads with exact total rise, spindle and continuous handrail ownership',()=>{
 const before=JSON.stringify(stair),plan=spiralStairPlan(stair),geometry=spiralTreadGeometry(stair,plan.angle,plan.thickness)
 expect(plan.steps).toHaveLength(Math.ceil(stair.height/stair.riserHeight))
 expect(plan.steps.at(-1)!.center[1]+plan.thickness).toBeCloseTo(6.4)
 expect(geometry.index).not.toBeNull();expect([...geometry.getAttribute('normal').array].every(Number.isFinite)).toBe(true)
 const material=new MeshBasicMaterial({side:DoubleSide}),mesh=new Mesh(geometry,material);mesh.updateMatrixWorld()
 expect(new Raycaster(new Vector3(0,2,0),new Vector3(0,-1,0)).intersectObject(mesh)).toHaveLength(0)
 const a=plan.angle/2
 expect(new Raycaster(new Vector3(Math.cos(a),2,Math.sin(a)),new Vector3(0,-1,0)).intersectObject(mesh).length).toBeGreaterThan(0)
 expect([...plan.posts,...plan.rails,plan.pole].every(p=>p.selection?.id===stair.id&&[...p.center,...p.size,p.rotation].every(Number.isFinite))).toBe(true)
 expect(JSON.stringify(stair)).toBe(before);geometry.dispose();material.dispose()
})
test('spiral grounding follows both winding directions across full turns without a head collision or a centre shortcut',()=>{
 for(const clockwise of [true,false]){
  const source={...stair,clockwise},project=architecturalQualitySample(),level=project.buildings[0].levels[0];source.levelId=level.id
  const world=buildWalkSurfaces([{...level,walls:[],rooms:[],slabs:[],doors:[],windows:[]}],[source]),obstacles=buildWalkObstacles([level],new Set(),undefined,false,[source])
  let foot=0
  for(let i=0;i<=400;i++){
   const a=source.rotation*Math.PI/180+(clockwise?1:-1)*i/400*source.height/source.turnHeight*2*Math.PI,x=source.center.x+Math.cos(a),z=source.center.z+Math.sin(a)
   const next=floorAt(world,x,z,foot);expect(next-foot).toBeLessThanOrEqual(.3);expect(headBlocked(world,x,z,next)).toBe(false);foot=next
  }
  expect(foot).toBeCloseTo(source.height)
  expect(blockedAt(obstacles,source.center.x,source.center.z,0)).toBe(true)
 }
})
test('level inspection preserves spiral phase and top-floor openings without mutating the stored stair',()=>{
 const project=architecturalQualitySample(),building=project.buildings[0],ground=building.levels[0],upper=duplicateLevel(ground,'Upper',3.2)
 building.levels.push(upper);const source={...stair,levelId:ground.id};building.systems!.systems.push(source)
 expect(validateSystems(building)).toEqual([])
 const shown=visibleSystems(building,new Set([upper.id]),true).find(s=>s.id===source.id)!
 expect(shown).toMatchObject({height:6.4,elevation:0,renderSlice:{bottom:3.2,top:6.4}})
 const plan=spiralStairPlan(source,shown.renderSlice);expect(plan.steps[0].center[1]).toBeGreaterThan(3)
 expect(levelWithSystemVoids(upper,building).slabs![0].openings.some(o=>o.id===source.id)).toBe(true)
 expect(levelWithSystemVoids(ground,building).slabs![0].openings.some(o=>o.id===source.id)).toBe(false)
 const landings=spiralStairPlan(source,undefined,building.levels)
 expect(landings.platforms).toHaveLength(2)
 const obstacles=buildWalkObstacles(building.levels.map(l=>({...l,walls:[],doors:[]})),new Set(),undefined,false,[{...source,rotation:0}])
 expect(blockedAt(obstacles,source.center.x+source.radius-.02,source.center.z,upper.elevation)).toBe(false)
 const invalid={...source,width:source.radius};building.systems!.systems=[invalid]
 expect(validateSystems(building).length).toBeGreaterThan(0)
})
