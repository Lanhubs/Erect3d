import type {Intelligence} from '../../contracts/analysis'
import type {Project} from '../../contracts/project'
import {atWall} from '../../../../client/src/geometry/math'
import {wallCoverage} from './wall-coverage'
import {containsPoint} from '../../../../client/src/geometry/polygons'
import type {ModelQuality} from './quality'
type Point={x:number;z:number}
function edgeDistance(p:Point,a:Point,b:Point){
 const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1)))
 return Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz)
}
const boundaryDistance=(p:Point,ring:Point[])=>Math.min(...ring.map((a,i)=>edgeDistance(p,a,ring[(i+1)%ring.length])))
export function sourceCoverage(proposal:Intelligence,project:Project,levelId:string,dimensions?:{width:number;height:number}):ModelQuality['issues']{
 const level=project.buildings.flatMap(b=>b.levels).find(l=>l.id===levelId)
 if(!level)return []
 const issues:ModelQuality['issues']=[]
 const wallAt=wallCoverage(level.walls)
 const warn=(code:string,message:string,candidateId?:string)=>issues.push({code,severity:'warning',message,candidateId})
 for(const room of level.rooms){
  const ring=room.polygon
  const opens=[...level.doors,...level.passages||[]].some(opening=>{
   const host=level.walls.find(w=>w.id===opening.wallId)
   return host&&opening.width>=.5&&boundaryDistance(atWall(host,opening.offset+opening.width/2),ring)<host.thickness+.2
  })
  if(opens)continue
  // An open-plan boundary is circulation, not a missing door. Require a clear
  // continuous interval, not tiny corner tolerances or a window in a solid host.
  let free=0,best=0
  for(let i=0;i<ring.length;i++){
   const a=ring[i],b=ring[(i+1)%ring.length],length=Math.hypot(b.x-a.x,b.z-a.z),steps=Math.max(1,Math.min(4096,Math.ceil(length/.08)))
   free=0
   for(let j=0;j<steps;j++){
    const p={x:a.x+(b.x-a.x)*(j+.5)/steps,z:a.z+(b.z-a.z)*(j+.5)/steps}
    const covered=wallAt(p,b.x-a.x,b.z-a.z,length)
    free=covered?0:free+length/steps;best=Math.max(best,free)
   }
  }
  const enclosed=/bed\s*room|bath|closet|pantry|toilet|\bwc\b|garage|store|utility|laundry|office|study/i.test(room.name)
  if(best<.65||enclosed)warn('ROOM_NO_ACCESS',`${room.name} has no identified entrance. Check its depicted door or passage; an unclassified gap in a private room is not a confirmed entrance.`,project.interpretation?.[room.id]?.candidateId)
 }
 const scale=proposal.understanding?.scale
 if(dimensions&&scale?.origin==='annotated'){
  const pixel=(p:{x:number;y:number})=>({x:p.x*dimensions.width,z:p.y*dimensions.height})
  const a=pixel(scale.a),b=pixel(scale.b)
  const room=proposal.candidates.find(c=>c.kind==='room'&&c.points.length>=3&&[a,b].every(p=>{
   const ring=c.points.map(pixel);return containsPoint(ring,p)&&boundaryDistance(p,ring)>4
  }))
  if(room)warn('SCALE_REFERENCE_INTERIOR',`Both endpoints of the claimed printed dimension lie inside ${room.label||'a room'}, away from its boundary. Anchor the measured distance to the actual dimension endpoints or wall faces; do not measure the furniture.`,room.id)
 }
 return issues
}
