import type {Building,Level,Slab} from '../domain/types'
import type {ArchitecturalModel} from '../domain/buildingSystems'
import {systemOpenings} from './systemOpenings'
import {containsPolygon} from './polygons'
const cache=new WeakMap<Slab[],{systems:ArchitecturalModel;levels:string;elevation:number;slabs:Slab[];level:Level;result:Level}>()
export function levelWithSystemVoids(level:Level,building:Building):Level{
  const systems=building.systems,source=level.slabs
  if(!systems||!source)return level
  const levels=building.levels.map(l=>`${l.id}:${l.elevation}`).join('|'),previous=cache.get(source)
  if(previous?.systems===systems&&previous.levels===levels&&previous.elevation===level.elevation){
    if(previous.level===level)return previous.result
    const result=previous.slabs===source?level:{...level,slabs:previous.slabs}
    cache.set(source,{...previous,level,result});return result
  }
  const voids=systemOpenings(building).filter(s=>s.base<=level.elevation+.001&&(s.stair?s.base+s.height>=level.elevation&&level.elevation>s.base+.001:s.base+s.height>level.elevation))
  if(!voids.length){cache.set(source,{systems,levels,elevation:level.elevation,slabs:source,level,result:level});return level}
  const slabs=source.map(slab=>{
    const holes=voids.filter(s=>!slab.openings.some(o=>o.id===s.id)&&containsPolygon(slab.polygon,s.polygon))
      .map(s=>({id:s.id,kind:'void' as const,polygon:s.polygon}))
    return holes.length?{...slab,openings:[...slab.openings,...holes]}:slab
  })
  const result=slabs.every((slab,index)=>slab===source[index])?level:{...level,slabs}
  cache.set(source,{systems,levels,elevation:level.elevation,slabs:result.slabs!,level,result})
  return result
}
