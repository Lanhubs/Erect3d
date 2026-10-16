import type {Level} from '../domain/types'
// Preserve each host's input identity when an unrelated opening is edited.
// This is owned by one level renderer, rather than a global document cache.
export function createOpeningIndex(){
 let previous=new Map<string,{doors:Level['doors'];windows:Level['windows'];passages:NonNullable<Level['passages']>}>()
 return (level:Level)=>{
  const next=new Map<string,{doors:Level['doors'];windows:Level['windows'];passages:NonNullable<Level['passages']>}>()
  const reuse=<T>(before:T[]|undefined,after:T[])=>before?.length===after.length&&after.every((item,i)=>item===before[i])?before:after
  for(const wall of level.walls){
   const old=previous.get(wall.id),doors=reuse(old?.doors,level.doors.filter(o=>o.wallId===wall.id)),windows=reuse(old?.windows,level.windows.filter(o=>o.wallId===wall.id)),passages=reuse(old?.passages,(level.passages||[]).filter(o=>o.wallId===wall.id))
   next.set(wall.id,old&&old.doors===doors&&old.windows===windows&&old.passages===passages?old:{doors,windows,passages})
  }
  previous=next;return next
 }
}
