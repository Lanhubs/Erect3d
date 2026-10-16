import type {ArticulationSystem} from '../domain/buildingSystems'
import type {Level} from '../domain/types'
import {atWall} from './math'
import type {FacadeRect} from './facadeOpenings'
import {articulationPath} from './articulationPath'
export function articulationOpenings(system:ArticulationSystem,level?:Level,windows=true):FacadeRect[]{
  if(!level)return []
  const [a,b]=system.path,dx=b.x-a.x,dz=b.z-a.z,{length}=articulationPath(system),curve=system.curve,result:FacadeRect[]=[]
  for(const wall of level.walls){
    const openings=[...level.doors,...(level.passages||[]),...(windows?level.windows:[])].filter(o=>o.wallId===wall.id)
    for(const opening of openings){
      const points=[atWall(wall,opening.offset),atWall(wall,opening.offset+opening.width)]
      if(points.some(p=>(curve?Math.abs(Math.hypot(p.x-curve.center.x,p.z-curve.center.z)-curve.radius):Math.abs((p.x-a.x)*dz-(p.z-a.z)*dx)/length)>wall.thickness/2+.025))continue
      const along=points.map(p=>{
        if(!curve)return ((p.x-a.x)*dx+(p.z-a.z)*dz)/length
        const raw=Math.atan2(p.z-curve.center.z,p.x-curve.center.x),mid=(curve.startAngle+curve.endAngle)/2,angle=raw+Math.round((mid-raw)/(2*Math.PI))*2*Math.PI
        return (angle-curve.startAngle)*curve.radius*Math.sign(curve.endAngle-curve.startAngle)
      })
      const bottom='sill' in opening?Number(opening.sill):0
      if(Math.max(...along)<=0||Math.min(...along)>=length)continue
      result.push({left:Math.max(0,Math.min(...along))-length/2,right:Math.min(length,Math.max(...along))-length/2,bottom,top:bottom+opening.height})
    }
  }
  return result
}
