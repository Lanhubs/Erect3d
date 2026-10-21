import {z} from 'zod'
import * as elements from '../../contracts/elements'
import {furniture,level as levelSchema} from '../../contracts/project'
import {roof,roofSection,fence} from '../../contracts/roof-site'
import {systemSchema} from '../../contracts/architecture'
import type {Project,Building,Level} from '../../contracts/project'
import {ApiError} from '../../security/errors'
export const schemas={wall:elements.wall,door:elements.door,window:elements.windowUnit,passage:elements.passage,room:elements.room,
  slab:elements.slab,column:elements.column,stair:elements.stair,ramp:elements.ramp,detail:elements.detail,furniture,system:systemSchema,
  'roof-section':roofSection,level:levelSchema,roof,fence}
export type Kind=keyof typeof schemas
export const collections={wall:'walls',door:'doors',window:'windows',passage:'passages',room:'rooms',slab:'slabs',column:'columns',
  stair:'stairs',ramp:'ramps',detail:'details',furniture:'furniture'} as const
export type Target={building:Building;level?:Level;value:any;parent:any;key:string|number;kind:Kind}
export function findTarget(project:Project,kind:Kind,id:string):Target {
  for(const building of project.buildings){
    if(kind==='fence' && building.siteFence?.id===id)return {building,value:building.siteFence,parent:building,key:'siteFence',kind}
    if(kind==='roof' && building.id===id)return {building,value:building.roof,parent:building,key:'roof',kind}
    for(const level of building.levels){
      if(kind==='level' && level.id===id)return {building,level,value:level,parent:building.levels,key:building.levels.indexOf(level),kind}
      if(kind==='roof' && level.id===id)return {building,level,value:level.roof,parent:level,key:'roof',kind}
      const collection=collections[kind as keyof typeof collections]
      const items=collection?(level[collection] as any[]|undefined):undefined,value=items?.find(e=>e.id===id)
      if(value)return {building,level,value,parent:items,key:items!.indexOf(value),kind}
    }
    const items:any[]|undefined=kind==='system'?building.systems?.systems:kind==='roof-section'?building.roofSections:undefined,value=items?.find(e=>e.id===id)
    if(value)return {building,level:building.levels.find(l=>l.id===value.levelId),value,parent:items,key:items!.indexOf(value),kind}
  }
  throw new ApiError(422,'ASSISTANT_TARGET','That model element no longer exists')
}
export function parseProperties(text:string){
  let value:unknown
  try{value=JSON.parse(text)}catch{throw new ApiError(422,'ASSISTANT_PROPERTIES','Properties must be a JSON object')}
  const check=(v:unknown):void=>{if(v&&typeof v==='object')for(const [key,item] of Object.entries(v)){
    if(['__proto__','prototype','constructor'].includes(key))throw new ApiError(422,'ASSISTANT_PROPERTIES','Unsafe property');check(item)
  }}
  if(!value||typeof value!=='object'||Array.isArray(value))throw new ApiError(422,'ASSISTANT_PROPERTIES','Properties must be an object')
  check(value);return value as Record<string,unknown>
}
export function describeSchema(kind:Kind){return z.toJSONSchema(schemas[kind])}
