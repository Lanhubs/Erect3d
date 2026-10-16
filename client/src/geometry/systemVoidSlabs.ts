import type {Building,Level,Slab} from '../domain/types'
import type {ArchitecturalModel} from '../domain/buildingSystems'
import {systemOpenings} from './systemOpenings'
import {containsPolygon} from './polygons'
const cache=new WeakMap<Slab[],{systems:ArchitecturalModel;levels:string;elevation:number;slabs:Slab[]}>()
export function levelWithSystemVoids(level:Level,building:Building):Level{
  const systems=building.systems,source=level.slabs
  if(!systems||!source)return level
  const levels=building.levels.map(l=>`${l.id}:${l.elevation}`).join('|'),previous=cache.get(source)
  if(previous?.systems===systems&&previous.levels===levels&&previous.elevation===level.elevation)return {...level,slabs:previous.slabs}
  const voids=systemOpenings(building).filter(s=>s.base<=level.elevation+.001&&(s.stair?s.base+s.height>=level.elevation&&level.elevation>s.base+.001:s.base+s.height>level.elevation))
  if(!voids.length)return level
  const slabs=source.map(slab=>{
    const holes=voids.filter(s=>!slab.openings.some(o=>o.id===s.id)&&containsPolygon(slab.polygon,s.polygon))
      .map(s=>({id:s.id,kind:'void' as const,polygon:s.polygon}))
    return holes.length?{...slab,openings:[...slab.openings,...holes]}:slab
  })
  cache.set(source,{systems,levels,elevation:level.elevation,slabs})
  return {...level,slabs}
}
