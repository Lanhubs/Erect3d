import {expect,test} from 'bun:test'
import {fixtureProject} from '../src/domain/fixture'
import {generateSiteFence,repairGeneratedFence,siteBounds,updateFenceBoundary} from '../src/geometry/site'
import {newSlab,normalizeProject} from '../src/domain/levels'
import {verandaGeometry} from '../src/geometry/veranda'
import {buildingEnvelope,fenceCrossesEnvelope} from '../src/geometry/siteEnvelope'
import {useProject} from '../src/state/project'
const rect=(x:number,z:number,w:number,d:number)=>[{x,z},{x:x+w,z},{x:x+w,z:z+d},{x,z:z+d}]
test('automatic fitting follows an upper wing and entrance veranda after model edits',()=>{
  const project=fixtureProject(),building=project.buildings[0],ground=building.levels[0]
  building.siteFence=generateSiteFence(ground)!
  const upper=structuredClone(ground);upper.id='upper-wing';upper.elevation=3;upper.slabs=[newSlab(rect(25,2,8,7))];upper.walls=[];upper.rooms=[];upper.doors=[]
  building.levels.push(upper)
  const door=ground.doors[0];door.veranda={width:5,depth:8,side:'right',covered:true,railing:true,roofShape:'shed',floorMaterial:'tile'}
  repairGeneratedFence(building)
  const bounds=siteBounds(building.siteFence)!,points=verandaGeometry(ground,door)!.polygon
  expect(bounds.maxX).toBeGreaterThan(33)
  for(const p of points){expect(p.x).toBeGreaterThan(bounds.minX);expect(p.x).toBeLessThan(bounds.maxX);expect(p.z).toBeGreaterThan(bounds.minZ);expect(p.z).toBeLessThan(bounds.maxZ)}
  const reloaded=normalizeProject(JSON.parse(JSON.stringify(project)))
  expect(siteBounds(reloaded.buildings[0].siteFence)).toEqual(bounds)
})
test('zero setbacks keep the inside face of a thick fence outside the building',()=>{
  const ground=fixtureProject().buildings[0].levels[0],fence=generateSiteFence(ground,{front:0,rear:0,left:0,right:0})!
  const bounds=siteBounds(fence)!,maxX=Math.max(...ground.walls.flatMap(w=>[w.start.x+w.thickness/2,w.end.x+w.thickness/2]))
  expect(bounds.maxX-fence.thickness/2).toBeGreaterThanOrEqual(maxX)
})
test('manual boundaries and valid gate identities survive automatic repair',()=>{
  const b=fixtureProject().buildings[0],f=generateSiteFence(b.levels[0])!
  f.gates=[{id:'gate',segmentId:f.segments[0].id,kind:'pedestrian',offset:1,width:1,height:1.2}]
  b.siteFence=updateFenceBoundary(f,rect(-1,-1,2,2));const before=structuredClone(b.siteFence)
  repairGeneratedFence(b);expect(b.siteFence).toEqual(before)
  expect(fenceCrossesEnvelope(b,b.siteFence!.boundary!,b.siteFence!.thickness)).toBe(true)
})
test('structural projections are enclosed while raster margins and furniture cannot grow the site',()=>{
  const b=fixtureProject().buildings[0],ground=b.levels[0]
  ground.columns=[{id:'column',position:{x:30,z:10},shape:'rectangular',width:2,depth:3,diameter:1,height:3,material:'concrete',rotation:30}]
  ground.ramps=[{id:'ramp',start:{x:-12,z:3},end:{x:0,z:3},width:2,thickness:.2,startElevation:0,endElevation:1,material:'concrete'}]
  const before=buildingEnvelope(b);(ground as unknown as {furniture:unknown[]}).furniture=[{position:{x:10000,z:10000}}]
  expect(buildingEnvelope(b)).toEqual(before)
  const fence=generateSiteFence(b)!,bounds=siteBounds(fence)!
  expect(bounds.maxX).toBeGreaterThan(31);expect(bounds.minX).toBeLessThan(-13)
  expect(fenceCrossesEnvelope(b,fence.boundary!,fence.thickness)).toBe(false)
})
test('editing a veranda refits automatic fences within the same undo checkpoint',()=>{
  const project=fixtureProject(),building=project.buildings[0];building.siteFence=generateSiteFence(building)!
  useProject.getState().setProject(project);const before=siteBounds(useProject.getState().project!.buildings[0].siteFence)
  useProject.getState().editProject(next=>{next.buildings[0].levels[0].doors[0].veranda={width:30,depth:8,side:'right',covered:true,railing:true,roofShape:'shed',floorMaterial:'tile'};return next})
  expect(siteBounds(useProject.getState().project!.buildings[0].siteFence)).not.toEqual(before)
  useProject.getState().undo();expect(siteBounds(useProject.getState().project!.buildings[0].siteFence)).toEqual(before)
  useProject.getState().setProject(null)
})
test('fitting preserves fence finishes, gate identities and disabled state',()=>{
  const b=fixtureProject().buildings[0],f=generateSiteFence(b)!
  f.enabled=false;f.color='#735336';f.segments[0]={...f.segments[0],material:'brick',color:'#a45533',thickness:.8}
  expect(generateSiteFence(b,f.setbacks,f)?.enabled).toBe(false)
  f.gates=[{id:'gate',segmentId:f.segments[0].id,kind:'pedestrian',offset:1,width:1,height:1.2}];b.siteFence=f
  repairGeneratedFence(b)
  expect(b.siteFence?.enabled).toBe(false);expect(b.siteFence?.color).toBe('#735336')
  expect(b.siteFence?.segments[0]).toMatchObject({material:'brick',color:'#a45533',thickness:.8})
  expect(b.siteFence?.gates[0]).toEqual(f.gates[0])
})
