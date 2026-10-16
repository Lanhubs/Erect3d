import type {Building} from '../domain/types'
export function systemOpenings(building:Building){
 return (building.systems?.systems||[]).flatMap(system=>{
  if(system.visible===false||!['void','shaft','spiral-stair'].includes(system.kind))return []
  if(system.kind!=='void'&&system.kind!=='shaft'&&system.kind!=='spiral-stair')return []
  const base=(building.levels.find(l=>l.id===system.levelId)?.elevation||0)+system.elevation
  const count=system.kind==='spiral-stair'?Math.min(4096,Math.max(48,Math.ceil(Math.PI/Math.acos(Math.max(-1,1-.005/system.radius))))):0
  const polygon=system.kind==='spiral-stair'?Array.from({length:count},(_,i)=>{
   const a=i/count*Math.PI*2;return {x:system.center.x+system.radius*Math.cos(a),z:system.center.z+system.radius*Math.sin(a)}
  }):system.polygon
  return [{id:system.id,polygon,base,height:system.height,stair:system.kind==='spiral-stair'}]
 })
}
