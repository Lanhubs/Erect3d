import type {Project} from '../../contracts/project'
import type {AnalysisJob,Intelligence} from '../../contracts/analysis'
import type {ModelQuality} from './quality'
export function retainDetailWarning(project:Project,input:AnalysisJob,proposal:Intelligence,quality:ModelQuality,measurements?:{walls:number;features:number}):ModelQuality {
  if(input.options.purpose!=='rebuild')return quality
  const level=project.buildings.flatMap(building=>building.levels).find(level=>level.id===input.levelId)
  const walls=proposal.candidates.filter(item=>item.kind==='wall').reduce((count,item)=>count+(item.curve?1:Math.max(0,item.points.length-1)),0)
  if(measurements && measurements.features>600 && measurements.walls>=24 && walls<measurements.walls*.5)return {...quality,status:quality.status==='blocked'?'blocked':'needs-review',issues:[...quality.issues,
    {code:'SOURCE_DETAIL_INCOMPLETE',severity:'warning',message:'The source contains dense architectural linework, but the reconstruction has relatively few wall segments. Inspect its coverage before replacing the model.'}]}
  if(!level || level.sourceId!==input.sourceId || level.walls.length<12)return quality
  if(walls>=level.walls.length*.65)return quality
  return {...quality,status:quality.status==='blocked'?'blocked':'needs-review',issues:[...quality.issues,{code:'DETAIL_REGRESSION',severity:'warning',
    message:`The proposal contains ${walls} wall segments versus ${level.walls.length} in the current interpretation of this source. Review omitted partitions before replacing this floor; the current model is retained.`}]}
}
