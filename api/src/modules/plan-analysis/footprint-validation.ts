import type { Candidate,Intelligence } from '../../contracts/analysis'
import { ApiError } from '../../security/errors'
import { containsPoint } from '../../../../client/src/geometry/polygons'
import {ShapeUtils,Vector2} from 'three'
type Point={x:number;z:number}
const cross=(a:Point,b:Point,c:Point)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x)
export function validRing(points:Point[]) {
  if (points.length<3) return false
  let area=0
  for (let i=0;i<points.length;i++) {
    const a=points[i],b=points[(i+1)%points.length];area+=a.x*b.z-b.x*a.z
    for (let j=i+2;j<points.length;j++) {
      if ((j+1)%points.length===i) continue
      const c=points[j],d=points[(j+1)%points.length]
      if (cross(a,b,c)*cross(a,b,d)<-1e-10 && cross(c,d,a)*cross(c,d,b)<-1e-10) return false
    }
  }
  return Math.abs(area)>.001
}
export function validateFootprint(proposal:Intelligence,candidates:Candidate[],width:number,height:number) {
  const pixel=(p:{x:number;y:number})=>({x:p.x*width,z:p.y*height})
  const footprint=(proposal.understanding?.footprint || []).map(pixel)
  const porchIds=new Set(proposal.architecturalRequirements?.systems.filter(s=>s.kind==='articulation'&&s.origin!=='design-proposal'&&['canopy','pergola','colonnade','veranda','balcony'].includes(s.profile||'')).map(s=>s.boundaryId))
  const porches=proposal.candidates.filter(c=>c.kind==='architectural-boundary'&&porchIds.has(c.id)&&c.points.length>=3).map(c=>c.points.map(pixel))
  if (footprint.length && !validRing(footprint)) throw new ApiError(422,'INVALID_FOOTPRINT','The source footprint crosses itself or has no area; review its understanding before rebuilding')
  const within=(p:Point,tolerance:number)=>containsPoint(footprint,p) || footprint.some((a,i)=>{
    const b=footprint[(i+1)%footprint.length],dx=b.x-a.x,dz=b.z-a.z
    const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz || 1)))
    return Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz)<=tolerance
  })
  for (const candidate of candidates) {
    let points=candidate.points.map(pixel)
    // Legacy fixtures provide diagonal bounds; oriented four-corner footprints
    // already describe the real source polygon and must not grow into an AABB.
    if(candidate.kind==='furniture'&&points.length!==4){
      const xs=points.map(p=>p.x),zs=points.map(p=>p.z),a={x:Math.min(...xs),z:Math.min(...zs)},b={x:Math.max(...xs),z:Math.max(...zs)}
      points=[a,{x:b.x,z:a.z},b,{x:a.x,z:b.z}]
    }
    if (['room','void','column','furniture'].includes(candidate.kind) && !validRing(points)) throw new ApiError(422,'INVALID_POLYGON',`Review ${candidate.id}: its polygon crosses itself or has no area`)
    if (!footprint.length || candidate.kind==='void' || candidate.kind==='architectural-boundary' || candidate.kind==='stair' && !candidate.targetLevelId) continue
    if(candidate.kind==='column'&&porches.some(ring=>points.every(p=>containsPoint(ring,p)||ring.some((a,i)=>Math.hypot(a.x-p.x,a.z-p.z)<3))))continue
    const tolerance=Math.max(2,(candidate.thickness || .004)*width)
    const checked=[...points]
    if(candidate.kind==='wall'&&!candidate.curve)checked.push(...points.slice(1).map((p,i)=>({x:(p.x+points[i].x)/2,z:(p.z+points[i].z)/2})))
    if(['room','column','furniture'].includes(candidate.kind)&&points.length>=3){
      // Boundary vertices alone accepted whole rooms inside an exterior notch.
      // Test real interior samples, including concave polygon triangulation.
      checked.push(...points.map((p,i)=>({x:(p.x+points[(i+1)%points.length].x)/2,z:(p.z+points[(i+1)%points.length].z)/2})))
      checked.push(...ShapeUtils.triangulateShape(points.map(p=>new Vector2(p.x,p.z)),[]).map(t=>({x:t.reduce((sum,i)=>sum+points[i].x,0)/3,z:t.reduce((sum,i)=>sum+points[i].z,0)/3})))
    }
    if (checked.some(p=>!within(p,tolerance))) throw new ApiError(422,'OUTSIDE_FOOTPRINT',`Review ${candidate.id}: geometry falls outside the drawn building footprint; margins must stay empty`)
  }
}
