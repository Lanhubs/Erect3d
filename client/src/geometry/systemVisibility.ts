import type {Building} from '../domain/types'
import type {BuildingSystem} from '../domain/buildingSystems'
export type VisibleSystem=BuildingSystem&{renderSlice?:{bottom:number;top:number}}
// Slice vertical systems for a level inspection without altering the saved model.
export function visibleSystems(building:Building,shownIds:ReadonlySet<string>,singleLevel:boolean):VisibleSystem[]{
  const systems=(building.systems?.systems||[]).filter(s=>s.visible!==false)
  if(!singleLevel)return systems.filter(s=>shownIds.has(s.levelId))
  const shown=building.levels.filter(l=>shownIds.has(l.id))
  return systems.flatMap<VisibleSystem>(system=>{
    if(system.kind==='typical-floors')return []
    if(system.kind==='articulation')return shownIds.has(system.levelId)?[system]:[]
    const host=building.levels.find(l=>l.id===system.levelId);if(!host)return []
    const base=host.elevation+system.elevation,end=base+system.height
    return shown.flatMap(level=>{
      const bottom=Math.max(base,level.elevation),top=Math.min(end,level.elevation+(level.floorToFloorHeight||3))
      return top>bottom+.001?[system.kind==='spiral-stair'?{...system,renderSlice:{bottom:bottom-base,top:top-base}}:{...system,elevation:bottom-host.elevation,height:top-bottom}]:[]
    })
  })
}
