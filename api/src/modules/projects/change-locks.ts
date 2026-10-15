import type {Project} from '../../contracts/project'
import type {Change} from '../../contracts/operations'
export function changeEntityIds(document:Project,changes:Change[]) {
  const ids=new Set(changes.flatMap(change=>change.path))
  const collect=(value:unknown)=>{
    if(!value || typeof value!=='object')return
    if(Array.isArray(value)){value.forEach(collect);return}
    const object=value as Record<string,unknown>
    if(typeof object.id==='string')ids.add(object.id)
    Object.values(object).forEach(collect)
  }
  for(const change of changes){
    let previous:any=document
    for(const part of change.path)previous=Array.isArray(previous)?previous.find(item=>item?.id===part):previous?.[part]
    collect(previous)
    if(change.action==='put')collect(change.value)
  }
  return [...ids]
}
