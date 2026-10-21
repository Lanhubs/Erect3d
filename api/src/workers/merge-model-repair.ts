import type {Intelligence} from '../contracts/analysis'
import {reconcile} from '../modules/ai/reconcile'
import type {ModelQuality} from '../modules/plan-analysis/quality'
export function mergeModelRepair(proposal:Intelligence,repaired:Intelligence,quality:ModelQuality,mode:string,scale:{width:number;height:number;metresPerPixel:number}){
 const architecture=quality.issues.some(issue=>/ARCHITECTURE|HEIGHT|FLOOR_DIMENSION/.test(issue.code))
 const patch={...repaired,designs:[],architecturalRequirements:architecture?repaired.architecturalRequirements:undefined}
 let merged=reconcile([],[proposal,patch],mode,scale,[])
 if(!merged.understanding)return merged
 // A host or door repair must not silently redesign a canopy or discard a
 // dimension established in the source. Global changes need a matching issue.
 const fixScale=!proposal.understanding?.scale||quality.issues.some(issue=>/SCALE/.test(issue.code))
 const fixFootprint=quality.issues.some(issue=>['INVALID_FOOTPRINT','OUTSIDE_FOOTPRINT'].includes(issue.code))
 merged={...merged,understanding:{...merged.understanding,
  ...(fixScale&&repaired.understanding?.scale?{scale:repaired.understanding.scale}:{}),
  ...(fixFootprint&&repaired.understanding?.footprint.length?{footprint:repaired.understanding.footprint}:{})}}
 return merged
}
