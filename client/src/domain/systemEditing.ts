import type {Point} from './types'
import type {ElementChange} from './elementGeometry'
import {systemPoints,validateSystems} from './systemValidation'
import type {Building} from './types'
export function mutateSystem(building:Building,id:string,change:ElementChange){
  const system=building.systems?.systems.find(s=>s.id===id)
  if(!system)return 'Select an architectural system first.'
  if(building.levels.find(l=>l.id===system.levelId)?.locked)return 'Unlock the host level before editing.'
  if(system.kind==='typical-floors')return 'Edit the template level to change linked floor geometry.'
  const points=systemPoints(system),center={x:points.reduce((s,p)=>s+p.x,0)/points.length,z:points.reduce((s,p)=>s+p.z,0)/points.length}
  const angle=(change.rotate||0)*Math.PI/180,scale=change.scale??1
  const map=(point:Point):Point=>{const x=(point.x-center.x)*scale,z=(point.z-center.z)*scale;return {
    x:center.x+x*Math.cos(angle)-z*Math.sin(angle)+(change.move?.x||0),z:center.z+x*Math.sin(angle)+z*Math.cos(angle)+(change.move?.z||0)}}
  if((system.kind==='curtain-wall'||system.kind==='articulation')&&system.curve){
    if(change.vertex)return 'Use the arc radius and angles to reshape a curved facade.'
    system.curve={...system.curve,center:map(system.curve.center),radius:system.curve.radius*scale,startAngle:system.curve.startAngle+angle,endAngle:system.curve.endAngle+angle}
  }
  const mapped=points.map((p,i)=>change.vertex?.index===i?change.vertex.point:map(p))
  const deform=(p:Point):Point=>{
    if(!change.vertex)return map(p)
    const closed='polygon' in system
    for(let i=0;i<points.length-(closed?0:1);i++){
      const j=(i+1)%points.length,a=points[i],b=points[j],dx=b.x-a.x,dz=b.z-a.z,length=dx*dx+dz*dz
      const t=length?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/length)):0
      if(Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz)<.25)return {x:mapped[i].x+(mapped[j].x-mapped[i].x)*t,z:mapped[i].z+(mapped[j].z-mapped[i].z)*t}
    }
    return p
  }
  if('polygon' in system)system.polygon=mapped
  if(system.kind==='articulation'&&system.footprint){system.footprint=mapped;system.path=change.vertex?mapped.slice(0,2):system.path.map(map)}
  else if('path' in system)system.path=mapped
  if(system.kind==='articulation'&&change.scale){system.depth*=scale;system.thickness*=scale;system.spacing*=scale}
  if('start' in system){system.start=mapped[0];system.end=mapped[1]}
  if(system.kind==='spiral-stair'){system.center=change.vertex?.point||map(system.center);system.radius*=scale;system.width*=scale;system.rotation+=(change.rotate||0)}
  if(system.kind==='massing')system.holes=system.holes.map(ring=>ring.map(map))
  if('wallIds' in system&&system.wallIds?.length){
    const level=building.levels.find(l=>l.id===system.levelId)!,ids=new Set(system.wallIds)
    const pairs=level.walls.filter(w=>ids.has(w.id)).flatMap(w=>[w.start,w.end].map(p=>({before:{...p},after:deform(p)})))
    const follow=(point:Point)=>pairs.find(pair=>Math.hypot(pair.before.x-point.x,pair.before.z-point.z)<.015)?.after||point
    for(const wall of level.walls){
      if(ids.has(wall.id)){wall.start=deform(wall.start);wall.end=deform(wall.end)
        if(wall.curve)wall.curve={...wall.curve,center:map(wall.curve.center),radius:wall.curve.radius*scale,startAngle:wall.curve.startAngle+angle,endAngle:wall.curve.endAngle+angle}
      }else{wall.start=follow(wall.start);wall.end=follow(wall.end)}
    }
    for(const opening of [...level.doors,...level.windows,...(level.passages||[])])if(ids.has(opening.wallId)){opening.offset*=scale;opening.width*=scale}
    level.rooms.forEach(room=>{room.polygon=room.polygon.map(follow)})
    level.slabs?.forEach(slab=>{slab.polygon=slab.polygon.map(follow)})
    building.roofSections?.filter(section=>section.levelId===level.id&&section.followFootprint).forEach(section=>{
      section.footprint=section.footprint.map(follow);section.voids=section.voids?.map(ring=>ring.map(follow))
    })
  }
  system.height+=change.height||0;system.origin='user-selected'
  return validateSystems(building)[0]||null
}
export function systemSelection(building:Building,id:string){
  const element=building.systems?.systems.find(s=>s.id===id)
  if(!element||element.kind==='typical-floors')return null
  const level=building.levels.find(l=>l.id===element.levelId)
  return level?{level,element,points:systemPoints(element),height:element.elevation+Math.min(element.height/2,2)}:null
}
