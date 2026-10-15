import {useMemo} from 'react'
import type {CanopyParameters} from '../geometry/arenaCanopyBuffers'
import {EntityInstances,type InstancePart} from './EntityInstances'
export function ArenaSkylights({parameters:p}:{parameters:CanopyParameters}){
  const parts=useMemo(()=>{
    if(p.coverage==='open')return []
    const parts:InstancePart[]=[],c=Math.cos(p.rotation),s=Math.sin(p.rotation)
    const world=(x:number,z:number):[number,number,number]=>[p.center.x+x*c-z*s,p.top+p.rise*(1-(x/p.radiusX)**2)*(.9+.1*(1-(z/p.radiusZ)**2))+.06,p.center.z+x*s+z*c]
    const beam=(x1:number,z1:number,x2:number,z2:number)=>{
      const a=world(x1,z1),b=world(x2,z2),dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2]
      parts.push({center:[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2],size:[Math.hypot(dx,dy,dz),.07,.07],rotation:-Math.atan2(dz,dx),slope:Math.atan2(dy,Math.hypot(dx,dz))})
    }
    for(const side of [-1,1]){
      const start=.09*p.radiusX*side,end=.32*p.radiusX*side,z1=-.8*p.radiusZ,z2=-.08*p.radiusZ
      const rows=Math.ceil((z2-z1)/1.8)
      for(let row=0;row<=rows;row++){
        const z=z1+(z2-z1)*row/rows
        for(let pane=0;pane<4;pane++)beam(start+(end-start)*pane/4,z,start+(end-start)*(pane+1)/4,z)
      }
      for(let column=0;column<=4;column++){
        const x=start+(end-start)*column/4
        for(let row=0;row<rows;row++)beam(x,z1+(z2-z1)*row/rows,x,z1+(z2-z1)*(row+1)/rows)
      }
    }
    return parts
  },[p])
  return parts.length?<EntityInstances parts={parts} color="#869aa6" material="metal" shadow={false}/>:null
}
