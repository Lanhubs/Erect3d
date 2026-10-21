import sharp from 'sharp'
import type {Intelligence} from '../contracts/analysis'
import {containsPoint} from '../../../client/src/geometry/polygons'
import {roofRegions} from '../../../client/src/geometry/roofRegions'
import {validRing} from '../modules/plan-analysis/footprint-validation'
type Point={x:number;z:number}
function closest(ring:Point[],point:Point) {
  let best={index:0,distance:Infinity}
  ring.forEach((a,index)=>{
    const b=ring[(index+1)%ring.length],dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.z-a.z)*dz)/(dx*dx+dz*dz || 1)))
    const distance=Math.hypot(point.x-a.x-t*dx,point.z-a.z-t*dz)
    if(distance<best.distance)best={index,distance}
  })
  return best
}
// A coarse AI envelope may cut through real partitions on curved/irregular plans.
// Extend it locally only to walls/columns supported by source pixels, never white space.
export async function sourceEnvelope(proposal:Intelligence,bytes:Uint8Array) {
  if(!proposal.understanding?.footprint.length)return proposal
  const {data,info}=await sharp(bytes,{limitInputPixels:100_000_000}).ensureAlpha().raw().toBuffer({resolveWithObject:true})
  const ring=proposal.understanding.footprint.map(p=>({x:p.x*info.width,z:p.y*info.height}))
  const dark=(x:number,y:number)=>{
    if(x<0 || y<0 || x>=info.width || y>=info.height)return false
    const at=(Math.round(y)*info.width+Math.round(x))*4,alpha=data[at+3]/255
    return ((data[at]*.2126+data[at+1]*.7152+data[at+2]*.0722)*alpha+255*(1-alpha))<200
  }
  const supported=(a:Point,b:Point)=>{
    const count=Math.max(2,Math.min(3000,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/2)));let hits=0
    for(let index=0;index<=count;index++) {
      const x=a.x+(b.x-a.x)*index/count,y=a.z+(b.z-a.z)*index/count
      let found=false
      for(let dy=-2;dy<=2 && !found;dy++)for(let dx=-2;dx<=2 && !found;dx++)found=dark(x+dx,y+dy)
      if(found)hits++
    }
    // A continuous host can cross a genuine door/window gap; require majority ink support.
    return hits/(count+1)>=.55
  }
  let changed=false
  // A concave outline sometimes walks up both sides of an interior foyer and
  // leaves its whole floor outside. Fill only an identified indoor source room
  // whose vertices already lie inside/on the envelope; never expand to margins.
  for(const room of proposal.candidates.filter(c=>c.kind==='room'&&c.confidence>=.7&&/kitchen|living|dining|foyer|hall|lobby|entry|bed|bath|closet|pantry|utility|office|store|laundry|wine|garage|corridor/i.test(c.label||'')&&!/court|atrium|outdoor|patio|terrace|garden|parking/i.test(c.label||''))){
    const points=room.points.map(p=>({x:p.x*info.width,z:p.y*info.height}))
    if(points.length<3||!points.every(p=>containsPoint(ring,p)||closest(ring,p).distance<=2))continue
    const union=roofRegions([ring,points])
    if(union.length!==1||union[0].voids.length||!validRing(union[0].footprint))continue
    const next=union[0].footprint
    if(next.length!==ring.length||next.some((p,i)=>Math.hypot(p.x-ring[i].x,p.z-ring[i].z)>.01)){ring.splice(0,ring.length,...next);changed=true}
  }
  for(const wall of proposal.candidates.filter(item=>(item.kind==='wall' && !item.curve || item.kind==='column') && item.confidence>=.5)) {
    const points=wall.points.map(p=>({x:p.x*info.width,z:p.y*info.height}))
    if(wall.kind==='column'){
      if(points.length<3 || points.every(p=>containsPoint(ring,p)) || points.some(p=>!containsPoint(ring,p) && closest(ring,p).distance>Math.min(info.width,info.height)*.05))continue
      if(!points.every((p,index)=>supported(p,points[(index+1)%points.length])))continue
      const union=roofRegions([ring,points])
      if(union.length===1 && !union[0].voids.length&&validRing(union[0].footprint)){ring.splice(0,ring.length,...union[0].footprint);changed=true}
      continue
    }
    if(wall.wallKind==='interior'||wall.wallKind==='partition')continue
    for(let index=1;index<points.length;index++) {
      const a=points[index-1],b=points[index]
      if(!supported(a,b))continue
      const point={x:(a.x+b.x)/2,z:(a.z+b.z)/2}
      if(containsPoint(ring,point))continue
      const near=closest(ring,point),i=near.index,j=(i+1)%ring.length,p=ring[i],q=ring[j]
      if(near.distance<1||near.distance>Math.max(3,(wall.thickness||0)*info.width*.75))continue
      const dx=q.x-p.x,dz=q.z-p.z,length=Math.hypot(dx,dz),wl=Math.hypot(b.x-a.x,b.z-a.z)
      if(Math.abs(dx*(b.x-a.x)+dz*(b.z-a.z))/(length*wl||1)<.99)continue
      // Snap a nearby parallel edge outward as one span. Never insert every
      // interior stroke endpoint into a roof outline: that produced sawteeth.
      const t=((point.x-p.x)*dx+(point.z-p.z)*dz)/(length*length||1),shift={x:point.x-p.x-t*dx,z:point.z-p.z-t*dz}
      const fitted=ring.map((v,k)=>k===i||k===j?{x:v.x+shift.x,z:v.z+shift.z}:v)
      if(!validRing(fitted))continue
      ring.splice(0,ring.length,...fitted);changed=true
    }
  }
  if(!changed)return proposal
  return {...proposal,understanding:{...proposal.understanding,footprint:ring.map(p=>({x:p.x/info.width,y:p.z/info.height}))},
    warnings:[...proposal.warnings,'The estimated envelope was fitted locally to source-supported walls and columns. Review curved boundaries against the source.'].slice(0,100)}
}
