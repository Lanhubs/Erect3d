import type {Wall,Point} from '../../../../client/src/domain/types'
import {wallSubpath} from '../../../../client/src/geometry/math'
type Segment={a:Point;dx:number;dz:number;length2:number;tolerance:number}
// Functional room checks query only nearby segments. Scanning every wall for
// every perimeter sample made dense multi-room plans unnecessarily expensive.
export function wallCoverage(walls:Wall[]){
 const cells=new Map<string,Segment[]>(),cell=2
 for(const wall of walls){
  const path=wallSubpath(wall),tolerance=Math.max(.12,wall.thickness*.8)
  for(let i=1;i<path.length;i++){
   const a=path[i-1],b=path[i],dx=b.x-a.x,dz=b.z-a.z,length2=dx*dx+dz*dz
   if(!length2)continue
   const segment={a,dx,dz,length2,tolerance},count=Math.ceil(Math.sqrt(length2)/cell)
   for(let j=0;j<=count;j++){
    const x=a.x+dx*j/Math.max(1,count),z=a.z+dz*j/Math.max(1,count)
    for(let ix=Math.floor((x-tolerance)/cell)-1;ix<=Math.floor((x+tolerance)/cell)+1;ix++)for(let iz=Math.floor((z-tolerance)/cell)-1;iz<=Math.floor((z+tolerance)/cell)+1;iz++){
     const key=`${ix},${iz}`,bucket=cells.get(key)||[]
     if(bucket.at(-1)!==segment)bucket.push(segment)
     cells.set(key,bucket)
    }
   }
  }
 }
 return (p:Point,dx:number,dz:number,length:number)=>{
  const bucket=cells.get(`${Math.floor(p.x/cell)},${Math.floor(p.z/cell)}`)||[]
  return bucket.some(s=>{
   if(Math.abs(dx*s.dx+dz*s.dz)/(length*Math.sqrt(s.length2)||1)<.9)return false
   const t=Math.max(0,Math.min(1,((p.x-s.a.x)*s.dx+(p.z-s.a.z)*s.dz)/s.length2))
   return Math.hypot(p.x-s.a.x-t*s.dx,p.z-s.a.z-t*s.dz)<=s.tolerance
  })
 }
}
