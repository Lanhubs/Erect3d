import type {FacadeSystem} from '../domain/buildingSystems'
import type {Point,Level} from '../domain/types'
import type {InstancePart} from '../rendering/EntityInstances'
import {facadeOpenings,subtractFacadeOpenings} from './facadeOpenings'
export const facadeChordError=.005
export function facadePath(system:Pick<FacadeSystem,'curve'|'path'>){
  if(!system.curve)return system.path
  const {center,radius,startAngle,endAngle}=system.curve,sweep=endAngle-startAngle
  const step=2*Math.acos(Math.max(-1,1-facadeChordError/radius))
  const count=Math.max(1,Math.ceil(Math.abs(sweep)/Math.max(.001,step)))
  if(!Number.isFinite(count)||count>4096)throw new Error('Facade curve exceeds the geometry budget.')
  return Array.from({length:count+1},(_,i)=>({x:center.x+radius*Math.cos(startAngle+sweep*i/count),z:center.z+radius*Math.sin(startAngle+sweep*i/count)}))
}
export function facadeParts(system:FacadeSystem,level?:Level){
  const glass:InstancePart[]=[],frame:InstancePart[]=[],posts=new Set<string>(),selection={kind:'architecture' as const,id:system.id}
  const tiers=Math.max(1,Math.ceil(system.height/system.transomHeight))
  const line=(a:Point,b:Point,bottom:number,height:number,depth:number):InstancePart=>({center:[(a.x+b.x)/2,bottom+height/2,(a.z+b.z)/2],
    size:[Math.hypot(b.x-a.x,b.z-a.z),height,depth],rotation:-Math.atan2(b.z-a.z,b.x-a.x),selection})
  const runs:{a:Point;b:Point;curve?:FacadeSystem['curve']}[]=system.curve?[{a:system.path[0],b:system.path.at(-1)!,curve:system.curve}]:system.path.slice(0,-1).map((a,i)=>({a,b:system.path[i+1]}))
  for(const {a,b,curve} of runs){
    const length=curve?curve.radius*Math.abs(curve.endAngle-curve.startAngle):Math.hypot(b.x-a.x,b.z-a.z)
    if(length<.001)continue
    const bays=Math.max(1,Math.round(length/system.bayWidth))
    const angularStep=curve?2*Math.acos(Math.max(-1,1-facadeChordError/curve.radius)):1
    const slices=curve?Math.max(1,Math.ceil(Math.abs(curve.endAngle-curve.startAngle)/bays/Math.max(.001,angularStep))):1
    if(!Number.isFinite(bays*slices*tiers)||glass.length+frame.length+bays*slices*(tiers*2+2)+bays>50000)throw new Error('Facade exceeds the 50,000-part geometry budget.')
    const at=(t:number)=>curve?{x:curve.center.x+curve.radius*Math.cos(curve.startAngle+(curve.endAngle-curve.startAngle)*t),
      z:curve.center.z+curve.radius*Math.sin(curve.startAngle+(curve.endAngle-curve.startAngle)*t)}:{x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t}
    const openings=facadeOpenings(system,level,a,b)
    for(let bay=0;bay<=bays;bay++){
      const p=at(bay/bays),key=`${p.x.toFixed(6)}:${p.z.toFixed(6)}`
      if(!posts.has(key)){posts.add(key);const next=at(Math.min(1,bay/bays+.00001)),prior=at(Math.max(0,bay/bays-.00001))
        const t=bay/bays
        for(const piece of subtractFacadeOpenings({left:t-.03/length,right:t+.03/length,bottom:system.elevation,top:system.elevation+system.height},openings))
          frame.push({center:[p.x,(piece.bottom+piece.top)/2,p.z],size:[.06,piece.top-piece.bottom,system.depth],rotation:-Math.atan2(next.z-prior.z,next.x-prior.x),selection})}
      if(bay===bays)continue
      for(let slice=0;slice<slices;slice++){
        const left=(bay+slice/slices)/bays,right=(bay+(slice+1)/slices)/bays
        for(let row=0;row<tiers;row++)for(const piece of subtractFacadeOpenings({left,right,bottom:system.elevation+row*system.height/tiers,top:system.elevation+(row+1)*system.height/tiers},openings))
          glass.push(line(at(piece.left),at(piece.right),piece.bottom,piece.top-piece.bottom,.025))
        for(let row=0;row<=tiers;row++)for(const piece of subtractFacadeOpenings({left,right,bottom:system.elevation+row*system.height/tiers-.03,top:system.elevation+row*system.height/tiers+.03},openings))
          frame.push(line(at(piece.left),at(piece.right),piece.bottom,piece.top-piece.bottom,system.depth))
      }
    }
  }
  return {glass,frame}
}
