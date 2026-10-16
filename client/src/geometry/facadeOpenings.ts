import type {FacadeSystem} from '../domain/buildingSystems'
import type {Level,Point} from '../domain/types'
import {atWall} from './math'
export type FacadeRect={left:number;right:number;bottom:number;top:number}
export function facadeOpenings(system:FacadeSystem,level:Level|undefined,a:Point,b:Point):FacadeRect[]{
  if(!level||!system.wallIds?.length)return []
  const curve=system.curve,dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz)
  const along=(point:Point)=>{
    if(!curve)return ((point.x-a.x)*dx+(point.z-a.z)*dz)/(length*length)
    let angle=Math.atan2(point.z-curve.center.z,point.x-curve.center.x),sweep=curve.endAngle-curve.startAngle
    while(sweep>0&&angle<curve.startAngle-.00001)angle+=Math.PI*2
    while(sweep<0&&angle>curve.startAngle+.00001)angle-=Math.PI*2
    return (angle-curve.startAngle)/sweep
  }
  const result:FacadeRect[]=[]
  for(const wall of level.walls.filter(w=>system.wallIds!.includes(w.id))){
    for(const opening of [...level.doors,...(level.passages||[])].filter(o=>o.wallId===wall.id)){
      const start=atWall(wall,opening.offset),end=atWall(wall,opening.offset+opening.width)
      if(!curve&&Math.abs((start.x-a.x)*dz-(start.z-a.z)*dx)/length>wall.thickness+.05)continue
      const left=Math.min(along(start),along(end)),right=Math.max(along(start),along(end))
      if(right<=0||left>=1)continue
      result.push({left:Math.max(0,left),right:Math.min(1,right),bottom:0,top:opening.height})
    }
  }
  return result
}
export function subtractFacadeOpenings(input:FacadeRect,openings:FacadeRect[]):FacadeRect[]{
  let pieces=[input]
  for(const hole of openings)pieces=pieces.flatMap(rect=>{
    const l=Math.max(rect.left,hole.left),r=Math.min(rect.right,hole.right),b=Math.max(rect.bottom,hole.bottom),t=Math.min(rect.top,hole.top)
    if(r-l<1e-8||t-b<1e-8)return [rect]
    return [{...rect,right:l},{...rect,left:r},{left:l,right:r,bottom:rect.bottom,top:b},{left:l,right:r,bottom:t,top:rect.top}]
      .filter(p=>p.right-p.left>1e-8&&p.top-p.bottom>1e-8)
  })
  return pieces
}
