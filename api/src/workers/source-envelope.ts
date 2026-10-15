import sharp from 'sharp'
import type {Intelligence} from '../contracts/analysis'
import {containsPoint} from '../../../client/src/geometry/polygons'
import {roofRegions} from '../../../client/src/geometry/roofRegions'
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
  for(const wall of proposal.candidates.filter(item=>(item.kind==='wall' && !item.curve || item.kind==='column') && item.confidence>=.5)) {
    const points=wall.points.map(p=>({x:p.x*info.width,z:p.y*info.height}))
    if(wall.kind==='column'){
      if(points.length<3 || points.every(p=>containsPoint(ring,p)) || points.some(p=>!containsPoint(ring,p) && closest(ring,p).distance>Math.min(info.width,info.height)*.05))continue
      if(!points.every((p,index)=>supported(p,points[(index+1)%points.length])))continue
      const union=roofRegions([ring,points])
      if(union.length===1 && !union[0].voids.length){ring.splice(0,ring.length,...union[0].footprint);changed=true}
      continue
    }
    for(let index=1;index<points.length;index++) {
      const a=points[index-1],b=points[index]
      if(!supported(a,b))continue
      for(const point of [0,.25,.5,.75,1].map(t=>({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t}))) {
        if(containsPoint(ring,point))continue
        const near=closest(ring,point)
        if(near.distance<1 || near.distance>Math.min(info.width,info.height)*.05)continue
        ring.splice(near.index+1,0,point);changed=true
      }
    }
  }
  if(!changed)return proposal
  return {...proposal,understanding:{...proposal.understanding,footprint:ring.map(p=>({x:p.x/info.width,y:p.z/info.height}))},
    warnings:[...proposal.warnings,'The estimated envelope was fitted locally to source-supported walls and columns. Review curved boundaries against the source.'].slice(0,100)}
}
