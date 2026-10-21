import type {Intelligence} from '../../contracts/analysis'
import type {Project} from '../../contracts/project'
import type {ModelQuality} from './quality'
import {atWall} from '../../../../client/src/geometry/math'
type Point={x:number;z:number}
const gap=(p:Point,a:Point,b:Point)=>{
 const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1)))
 return Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz)
}
export function openingCoverage(proposal:Intelligence,project:Project,levelId:string,dimensions?:{width:number;height:number}):ModelQuality['issues']{
 const level=project.buildings.flatMap(b=>b.levels).find(l=>l.id===levelId)
 if(!dimensions||!level?.calibration||!proposal.understanding?.footprint.length)return []
 const cal=level.calibration,world=(p:{x:number;y:number}):Point=>({x:(p.x*dimensions.width-cal.a.x)*cal.metresPerPixel+(level.alignment?.x||0),z:(p.y*dimensions.height-cal.a.z)*cal.metresPerPixel+(level.alignment?.z||0)})
 const ring=proposal.understanding.footprint.map(world),issues:ModelQuality['issues']=[]
 const boundary=(point:Point,polygon:Point[])=>Math.min(...polygon.map((p,i)=>gap(point,p,polygon[(i+1)%polygon.length])))
 for(const room of level.rooms){
  if(!/bed\s*room|living|dining|study|office/i.test(room.name))continue
  if(!room.polygon.some(p=>boundary(p,ring)<.35))continue
  const glazed=level.windows.some(window=>{
   const wall=level.walls.find(w=>w.id===window.wallId)
   return wall&&boundary(atWall(wall,window.offset+window.width/2),room.polygon)<wall.thickness+.25
  })||level.doors.some(door=>{
   const wall=level.walls.find(w=>w.id===door.wallId)
   return wall&&door.style==='glazed'&&boundary(atWall(wall,door.offset+door.width/2),room.polygon)<wall.thickness+.25
  })
  if(!glazed)issues.push({code:'EXTERIOR_ROOM_OPENINGS_UNCHECKED',severity:'warning',candidateId:project.interpretation?.[room.id]?.candidateId,
   message:`${room.name} reaches the exterior but has no identified glazing. Inspect its source facade for windows or glazed doors; if none is depicted, retain that uncertainty rather than inventing one.`})
 }
 return issues
}
