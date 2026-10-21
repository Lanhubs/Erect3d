import type {Building} from './types'
import {typicalFloorElevation} from './typicalFloors'

export function representedStoreys(building:Building){
  // Match the editor's millimetre elevation tolerance. A detached template or
  // another group can represent an already authored elevation only once.
  const elevations=new Set(building.levels.map(level=>Math.round(level.elevation*1000)))
  for(const group of building.systems?.systems||[]){
    if(group.kind!=='typical-floors'||!building.levels.some(level=>level.id===group.templateLevelId))continue
    for(let index=0;index<group.count;index++)if(!group.detached[String(index)])elevations.add(Math.round(typicalFloorElevation(building,group,index)*1000))
  }
  return elevations.size
}
export function buildingLevelLabel(building:Building){
  const count=representedStoreys(building),layouts=building.levels.length
  return count===layouts?`${count} floor${count===1?'':'s'}`:`${count} storeys · ${layouts} editable layouts`
}
