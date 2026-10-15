import type {Building,Level,Project} from './types'
import type {TypicalFloorGroup} from './buildingSystems'
import {duplicateLevel} from './levels'
export function linkedFloorIndices(building:Building,group:TypicalFloorGroup){
  const template=building.levels.find(l=>l.id===group.templateLevelId)
  if(!template)return []
  const host=building.levels.find(l=>l.id===group.levelId)!
  return Array.from({length:group.count},(_,i)=>i).filter(i=>!group.detached[String(i)] &&
    Math.abs(host.elevation+group.elevation+i*group.floorHeight-template.elevation)>.001)
}
export function typicalFloorElevation(building:Building,group:TypicalFloorGroup,index:number){
  return (building.levels.find(l=>l.id===group.levelId)?.elevation || 0)+group.elevation+index*group.floorHeight
}
export function detachTypicalFloor(input:Project,buildingId:string,groupId:string,index:number):Project{
  const project=structuredClone(input),building=project.buildings.find(b=>b.id===buildingId)
  const group=building?.systems?.systems.find(s=>s.id===groupId)
  if(!building || group?.kind!=='typical-floors')throw new Error('Select a linked floor group.')
  const template=building.levels.find(l=>l.id===group.templateLevelId)
  if(!template || template.locked || !Number.isInteger(index)||index<0||index>=group.count)throw new Error('Choose an unlocked linked floor.')
  if(group.detached[String(index)])return project
  const elevation=typicalFloorElevation(building,group,index)
  const existing=building.levels.find(l=>Math.abs(l.elevation-elevation)<.001)
  if(existing)throw new Error('That elevation already has an editable level.')
  const level:Level=duplicateLevel(template,`${group.name} · floor ${index+1}`,elevation)
  level.floorToFloorHeight=group.floorHeight;level.autoRoof=false
  delete level.roof
  building.levels.push(level);group.detached[String(index)]=level.id
  return project
}
