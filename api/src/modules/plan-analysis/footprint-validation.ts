import type { Candidate,Intelligence } from '../../contracts/analysis'
import { ApiError } from '../../security/errors'
import { containsPoint } from '../../../../client/src/geometry/polygons'
type Point={x:number;z:number}
const cross=(a:Point,b:Point,c:Point)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x)
function validRing(points:Point[]) {
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
  if (footprint.length && !validRing(footprint)) throw new ApiError(422,'INVALID_FOOTPRINT','The source footprint crosses itself or has no area; review its understanding before rebuilding')
  const within=(p:Point,tolerance:number)=>containsPoint(footprint,p) || footprint.some((a,i)=>{
    const b=footprint[(i+1)%footprint.length],dx=b.x-a.x,dz=b.z-a.z
    const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz || 1)))
    return Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz)<=tolerance
  })
  for (const candidate of candidates) {
    let points=candidate.points.map(pixel)
    // Editable fixtures use an axis-aligned bounding box, including two diagonal
    // source corners. Validate the same physical footprint as the converter.
    if(candidate.kind==='furniture'){
      const xs=points.map(p=>p.x),zs=points.map(p=>p.z),a={x:Math.min(...xs),z:Math.min(...zs)},b={x:Math.max(...xs),z:Math.max(...zs)}
      points=[a,{x:b.x,z:a.z},b,{x:a.x,z:b.z}]
    }
    if (['room','void','column','furniture'].includes(candidate.kind) && !validRing(points)) throw new ApiError(422,'INVALID_POLYGON',`Review ${candidate.id}: its polygon crosses itself or has no area`)
    if (!footprint.length || candidate.kind==='void' || candidate.kind==='stair' && !candidate.targetLevelId) continue
    const tolerance=Math.max(2,(candidate.thickness || .004)*width)
    const checked=candidate.kind==='wall' && !candidate.curve?[...points,...points.slice(1).map((p,i)=>({x:(p.x+points[i].x)/2,z:(p.z+points[i].z)/2}))]:points
    if (checked.some(p=>!within(p,tolerance))) throw new ApiError(422,'OUTSIDE_FOOTPRINT',`Review ${candidate.id}: geometry falls outside the drawn building footprint; margins must stay empty`)
  }
}
