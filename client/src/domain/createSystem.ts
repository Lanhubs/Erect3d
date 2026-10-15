import type {BuildingSystem} from './buildingSystems'
import type {Level,Point} from './types'
import {uid} from './types'
import {systemCapabilities} from './systemCapabilities'
export function createSystem(kind:BuildingSystem['kind'],level:Level):BuildingSystem{
  const p=(x:number,z:number):Point=>({x,z}),polygon=level.slabs?.[0]?.polygon || level.rooms[0]?.polygon || [p(0,0),p(8,0),p(8,6),p(0,6)]
  const xs=polygon.map(p=>p.x),zs=polygon.map(p=>p.z),cx=(Math.min(...xs)+Math.max(...xs))/2,cz=(Math.min(...zs)+Math.max(...zs))/2
  const base={id:uid('system'),levelId:level.id,name:systemCapabilities[kind].label,origin:'user-selected' as const,
    evidence:'Created in the architectural systems editor',color:'#98a4ab',elevation:0}
  if(kind==='typical-floors')return {...base,kind,templateLevelId:level.id,count:10,floorHeight:level.floorToFloorHeight||3.2,detached:{}}
  if(kind==='curtain-wall')return {...base,kind,path:polygon.slice(0,2).map(p=>({...p})),height:3.2,bayWidth:1.5,transomHeight:1.6,depth:.12}
  if(kind==='beam')return {...base,kind,start:{...polygon[0]},end:{...polygon[1]},elevation:2.8,width:.25,height:.4}
  if(kind==='massing')return {...base,kind,role:'podium',polygon:polygon.map(p=>({...p})),holes:[],height:3.2}
  const ring=[p(cx-1,cz-1),p(cx+1,cz-1),p(cx+1,cz+1),p(cx-1,cz+1)]
  if(kind==='void')return {...base,kind,role:'atrium',polygon:ring,height:10}
  return {...base,kind,polygon:ring,height:3.2,thickness:.2}
}
