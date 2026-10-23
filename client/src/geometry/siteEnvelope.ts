import type {Building,Level,Point} from '../domain/types'
import {wallBoundsPoints} from './math'
import {stairOpening} from './stairs'
import {verandaGeometry} from './veranda'
import {containsPoint} from './polygons'

const expand=(points:Point[],half:number)=>points.flatMap(p=>[{x:p.x-half,z:p.z-half},{x:p.x+half,z:p.z+half}])
export function envelopeRectangle(points:Point[]):Point[]{
  points=points.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.z))
  if(!points.length)return []
  const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x)),minZ=Math.min(...points.map(p=>p.z)),maxZ=Math.max(...points.map(p=>p.z))
  return [{x:minX,z:minZ},{x:maxX,z:minZ},{x:maxX,z:maxZ},{x:minX,z:maxZ}]
}
function levelEnvelope(level:Level,levels:Level[]):Point[][]{
  return [
    ...(level.slabs||[]).map(s=>s.polygon),...level.rooms.map(r=>r.polygon),
    ...level.walls.map(w=>envelopeRectangle(expand(wallBoundsPoints([w]),w.thickness/2))),
    ...level.doors.flatMap(d=>{const g=verandaGeometry(level,d);return g?[g.polygon]:[]}),
    ...(level.columns||[]).map(c=>{
      const angle=(c.rotation||0)*Math.PI/180,halfX=c.shape==='circular'?c.diameter/2:c.width/2,halfZ=c.shape==='circular'?c.diameter/2:c.depth/2
      return [-1,1].flatMap(a=>[-1,1].map(b=>({x:c.position.x+a*halfX*Math.cos(angle)-b*halfZ*Math.sin(angle),z:c.position.z+a*halfX*Math.sin(angle)+b*halfZ*Math.cos(angle)})))
    }).map(envelopeRectangle),
    ...(level.ramps||[]).map(r=>envelopeRectangle(expand([r.start,r.end],r.width/2))),
    ...(level.stairs||[]).map(s=>stairOpening(s,levels)),
    ...(level.details||[]).map(d=>envelopeRectangle(expand([d.start,d.end],d.depth/2))),
  ].filter(p=>p.length>=3)
}
/** Model coordinates already include alignment; source raster bounds never enter this envelope. */
export function buildingEnvelope(input:Building|Level):Point[][]{
  if(!('levels' in input))return levelEnvelope(input,[input])
  const above=input.levels.filter(l=>l.elevation+(l.floorToFloorHeight||Math.max(3,...l.walls.map(w=>w.height)))>0)
  const polygons=above.flatMap(l=>levelEnvelope(l,input.levels))
  for(const system of input.systems?.systems||[]){
    if(system.elevation+('height' in system?system.height:0)<0)continue
    if('polygon' in system&&system.kind!=='void')polygons.push(system.polygon)
    else if(system.kind==='curtain-wall')polygons.push(envelopeRectangle(expand(system.path,system.depth/2)))
    else if(system.kind==='beam')polygons.push(envelopeRectangle(expand([system.start,system.end],system.width/2)))
    else if(system.kind==='articulation')polygons.push(system.footprint||envelopeRectangle(expand(system.path,system.depth)))
    else if(system.kind==='spiral-stair')polygons.push(envelopeRectangle(expand([system.center],system.radius)))
  }
  return polygons.filter(p=>p.length>=3)
}
function distance(p:Point,a:Point,b:Point){const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1)));return Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz)}
function cross(a:Point,b:Point,c:Point){return (b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x)}
export function fenceCrossesEnvelope(building:Building,boundary:Point[],thickness:number){
  if(boundary.length<3)return false
  return buildingEnvelope(building).some(polygon=>polygon.some((p,i)=>{
    if(!containsPoint(boundary,p))return true
    const q=polygon[(i+1)%polygon.length]
    return boundary.some((a,j)=>{
      const b=boundary[(j+1)%boundary.length]
      return distance(p,a,b)<=thickness/2+1e-6 || (cross(p,q,a)*cross(p,q,b)<0&&cross(a,b,p)*cross(a,b,q)<0)
    })
  }))
}
