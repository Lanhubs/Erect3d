import {containsPolygon} from './polygons'
import type {Building,Level} from '../domain/types'
import type {BuildingSystem,FacadeSystem} from '../domain/buildingSystems'
import {systemPoints,validateSystems} from '../domain/systemValidation'
import type {InstancePart} from '../rendering/EntityInstances'
export type SystemPackage={id:string;system:BuildingSystem;parts:InstancePart[];glass:InstancePart[];frame:InstancePart[]}
export function facadePath(system:FacadeSystem){
  if(!system.curve)return system.path
  const {center,radius,startAngle,endAngle}=system.curve,sweep=endAngle-startAngle
  // A 5 mm chord error in project metres; semantic curves remain unchanged.
  const step=2*Math.acos(Math.max(-1,1-.005/radius)),count=Math.max(1,Math.ceil(Math.abs(sweep)/Math.max(.001,step)))
  if(count>4096)throw new Error('Facade curve exceeds the geometry budget.')
  return Array.from({length:count+1},(_,i)=>({x:center.x+radius*Math.cos(startAngle+sweep*i/count),z:center.z+radius*Math.sin(startAngle+sweep*i/count)}))
}
export function compileSystem(system:BuildingSystem):SystemPackage{
  const parts:InstancePart[]=[],glass:InstancePart[]=[],frame:InstancePart[]=[],selection={kind:'architecture' as const,id:system.id}
  const line=(a:{x:number;z:number},b:{x:number;z:number},bottom:number,height:number,depth:number):InstancePart=>({
    center:[(a.x+b.x)/2,bottom+height/2,(a.z+b.z)/2],size:[Math.hypot(b.x-a.x,b.z-a.z),height,depth],rotation:-Math.atan2(b.z-a.z,b.x-a.x),selection})
  if(system.kind==='core'||system.kind==='shaft')system.polygon.forEach((a,i)=>parts.push(line(a,system.polygon[(i+1)%system.polygon.length],system.elevation,system.height,system.thickness)))
  if(system.kind==='beam')parts.push(line(system.start,system.end,system.elevation,system.height,system.width))
  if(system.kind==='curtain-wall'){
    const path=facadePath(system)
    for(let i=0;i<path.length-1;i++){
      const a=path[i],b=path[i+1],length=Math.hypot(b.x-a.x,b.z-a.z),bays=system.curve?1:Math.max(1,Math.round(length/system.bayWidth))
      const tiers=Math.max(1,Math.ceil(system.height/system.transomHeight))
      if((bays+1)*(tiers+1)+parts.length+glass.length+frame.length>50000)throw new Error('Facade exceeds the geometry budget.')
      const at=(t:number)=>({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t})
      for(let j=0;j<bays;j++)glass.push(line(at(j/bays),at((j+1)/bays),system.elevation,system.height,.025))
      for(let j=0;j<=bays;j++){
        if(i>0&&j===0)continue
        const p=at(j/bays);frame.push({center:[p.x,system.elevation+system.height/2,p.z],size:[.06,system.height,system.depth],rotation:0,selection})
      }
      for(let j=0;j<=tiers;j++)frame.push(line(a,b,system.elevation+j*system.height/tiers-.03,.06,system.depth))
    }
  }
  return {id:system.id,system,parts,glass,frame}
}
export function compileBuildingSystems(building:Building){
  const errors=validateSystems(building)
  if(errors.length)return {errors,packages:[] as SystemPackage[]}
  try{return {errors,packages:(building.systems?.systems || []).map(compileSystem)}}catch(error){return {errors:[String(error)],packages:[] as SystemPackage[]}}
}
export function architecturalBounds(building:Building){
  let top=0;const points=[] as {x:number;z:number}[]
  for(const system of building.systems?.systems || []){
    const base=(building.levels.find(l=>l.id===system.levelId)?.elevation || 0)+system.elevation
    if(system.kind==='typical-floors'){
      const template=building.levels.find(l=>l.id===system.templateLevelId)
      if(template)points.push(...template.walls.flatMap(w=>[w.start,w.end]))
      top=Math.max(top,base+system.count*system.floorHeight)
    }else{points.push(...(system.kind==='curtain-wall'?facadePath(system):systemPoints(system)));top=Math.max(top,base+system.height)}
  }
  return {top,points}
}
export function levelWithSystemVoids(level:Level,building:Building):Level{
  const voids=(building.systems?.systems || []).filter(s=>s.kind==='void'||s.kind==='shaft').filter(s=>{
    const base=(building.levels.find(l=>l.id===s.levelId)?.elevation || 0)+s.elevation
    return base<=level.elevation+.001 && base+('height' in s?s.height:0)>level.elevation
  })
  if(!voids.length)return level
  return {...level,slabs:level.slabs?.map(slab=>({...slab,openings:[...slab.openings,...voids.filter(s=>'polygon' in s&&containsPolygon(slab.polygon,s.polygon)).map(s=>({id:s.id,kind:'void' as const,polygon:('polygon' in s?s.polygon:[])}))]}))}
}
