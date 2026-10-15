import type {Building,Point} from './types'
import type {BuildingSystem} from './buildingSystems'
import {containsPolygon} from '../geometry/polygons'
export function systemPoints(system:BuildingSystem):Point[]{
  if('polygon' in system)return system.polygon
  if('path' in system)return system.path
  if('start' in system)return [system.start,system.end]
  return []
}
function validRing(points:Point[]){
  if(points.length<3 || points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.z)))return false
  let area=0
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length];area+=a.x*b.z-b.x*a.z
    if(Math.hypot(a.x-b.x,a.z-b.z)<.001)return false
    for(let j=i+2;j<points.length;j++){
      if(i===0 && j===points.length-1)continue
      const c=points[j],d=points[(j+1)%points.length]
      const side=(p:Point,q:Point,r:Point)=>(q.x-p.x)*(r.z-p.z)-(q.z-p.z)*(r.x-p.x)
      if(side(a,b,c)*side(a,b,d)<0 && side(c,d,a)*side(c,d,b)<0)return false
    }
  }
  return Math.abs(area)>.0001
}
export function validateSystems(building:Building):string[]{
  const issues:string[]=[],ids=new Set<string>()
  for(const system of building.systems?.systems || []){
    const error=(message:string)=>issues.push(`${system.name}: ${message}`)
    if(ids.has(system.id))error('duplicate architectural identity');ids.add(system.id)
    const level=building.levels.find(l=>l.id===system.levelId)
    if(!level)error('host level is missing')
    if('polygon' in system && !validRing(system.polygon))error('footprint must be a simple nonzero polygon')
    if('height' in system && (!Number.isFinite(system.height)||system.height<=0))error('height must be positive')
    if(system.kind==='massing' && system.holes.some(h=>!validRing(h)||!containsPolygon(system.polygon,h)))error('void must be inside its mass')
    if(system.kind==='beam' && Math.hypot(system.start.x-system.end.x,system.start.z-system.end.z)<.01)error('beam requires a nonzero span')
    if(system.kind==='curtain-wall'){
      if(!Number.isFinite(system.bayWidth)||system.bayWidth<=0||system.transomHeight<=0||system.depth<=0)error('facade dimensions must be positive')
      if(system.path.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.z)))error('facade points must be finite')
    }
    if(system.kind==='typical-floors'){
      if(!building.levels.some(l=>l.id===system.templateLevelId))error('template level is missing')
      if(!Number.isInteger(system.count)||system.count<1||system.count>200||system.floorHeight<=0)error('invalid floor repetition')
      for(const [index,levelId] of Object.entries(system.detached))if(+index>=system.count||!building.levels.some(l=>l.id===levelId))error('detached floor link is invalid')
    }
  }
  return issues
}
