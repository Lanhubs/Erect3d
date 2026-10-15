import {useMemo} from 'react'
import type {Level,Selection,WindowUnit,Wall} from '../domain/types'
import {wallSolids,wallRects} from '../geometry/walls'
import {atWall,wallTangentAngle} from '../geometry/math'
import {EntityInstances,spatialBatches} from './EntityInstances'
type Part={center:[number,number,number];size:[number,number,number];rotation:number;selection:NonNullable<Selection>}
export function batchedFacadeIds(level:Level,generatedIds:ReadonlySet<string>,selection:Selection) {
  return new Set(level.walls.filter(wall=>generatedIds.has(wall.id) && !wall.curve && selection?.id!==wall.id &&
    !level.doors.some(door=>door.wallId===wall.id) && !level.passages?.some(item=>item.wallId===wall.id) &&
    !level.windows.some(window=>window.wallId===wall.id && selection?.id===window.id)).map(wall=>wall.id))
}
function windowParts(wall:Wall,window:WindowUnit) {
  const glass:Part[]=[],frames:Part[]=[],selection={kind:'window' as const,id:window.id}
  const point=atWall(wall,window.offset+window.width/2),angle=-wallTangentAngle(wall,window.offset+window.width/2)
  const add=(x:number,y:number,w:number,h:number,d:number)=>({center:[point.x+x*Math.cos(angle),y,point.z-x*Math.sin(angle)] as [number,number,number],size:[w,h,d] as [number,number,number],rotation:angle,selection})
  glass.push(add(0,window.sill+window.height/2,window.width-.1,window.height-.1,.04))
  for(const side of [-1,1])frames.push(add(side*window.width/2,window.sill+window.height/2,.06,window.height,.1))
  const horizontal=Math.max(1,Math.ceil(window.height/1.8))
  for(let index=0;index<=horizontal;index++)frames.push(add(0,window.sill+window.height*index/horizontal,window.width,.065,.1))
  const vertical=Math.max(1,Math.ceil(window.width/1.5))
  for(let index=1;index<vertical;index++)frames.push(add(-window.width/2+window.width*index/vertical,window.sill+window.height/2,.045,window.height,.09))
  return {glass,frames}
}
type WallParts={windows:WindowUnit[];concrete:Part[];glass:Part[];frames:Part[]}
const wallCache=new WeakMap<Wall,WallParts>()
export function facadeWallParts(wall:Wall,windows:WindowUnit[]):WallParts {
  const previous=wallCache.get(wall)
  if(previous && previous.windows.length===windows.length && windows.every((window,index)=>window===previous.windows[index]))return previous
  const concrete:Part[]=[],glass:Part[]=[],frames:Part[]=[]
  for(const solid of wallSolids(wall,[],windows,[]))for(const rect of wallRects(wall,solid)){
    concrete.push({...rect,selection:{kind:'wall',id:wall.id}})
    if(solid.bottom===0)frames.push({center:[rect.center[0],.045,rect.center[2]],size:[rect.size[0],.09,wall.thickness+.018],rotation:rect.rotation,selection:{kind:'wall',id:wall.id}})
  }
  for(const window of windows){const rows=windowParts(wall,window);glass.push(...rows.glass);frames.push(...rows.frames)}
  const result={windows,concrete,glass,frames};wallCache.set(wall,result);return result
}
export function ArchitectureFacade({level,ids,color,select}:{level:Level;ids:ReadonlySet<string>;color:string;select:(selection:Selection)=>void}) {
  const parts=useMemo(()=>{
    const concrete=new Map<string,Part[]>(),glass:Part[]=[],frames:Part[]=[]
    for(const wall of level.walls.filter(item=>ids.has(item.id))){
      const windows=level.windows.filter(window=>window.wallId===wall.id)
      const rows=facadeWallParts(wall,windows),tone=wall.color || color,parts=concrete.get(tone)||[]
      parts.push(...rows.concrete);concrete.set(tone,parts);glass.push(...rows.glass);frames.push(...rows.frames)
    }
    return {concrete,glass,frames}
  },[level,ids,color])
  return <group name="instanced-editable-architectural-facade">
    {[...parts.concrete].flatMap(([tone,rows])=>[...spatialBatches(rows)].map(([zone,batch])=><EntityInstances key={`${tone}:${zone}`} parts={batch} color={tone} select={select}/>))}
    {[...spatialBatches(parts.frames)].map(([zone,batch])=><EntityInstances key={`frame:${zone}`} parts={batch} color="#526069" material="metal" select={select}/>)}
    {[...spatialBatches(parts.glass)].map(([zone,batch])=><EntityInstances key={`glass:${zone}`} parts={batch} color="#a4c7d2" material="glass" shadow={false} select={select}/>)}
  </group>
}
