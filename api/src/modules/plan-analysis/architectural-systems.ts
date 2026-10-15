import type {AnalysisInput,Candidate,Intelligence} from '../../contracts/analysis'
import type {Project} from '../../contracts/project'
import type {BuildingSystem} from '../../../../client/src/domain/buildingSystems'
import {systemSchema} from '../../contracts/architecture'
import {validateSystems} from '../../../../client/src/domain/systemValidation'
import {imageToWorld} from './conversion'
import {digest} from '../../security/tokens'
import {ApiError} from '../../security/errors'
export function applyArchitecturalSystems(project:Project,input:AnalysisInput,analysisId:string,proposal:Intelligence,candidates:Candidate[],dimensions:{width:number;height:number}){
  if(!proposal.architecturalRequirements)return
  const building=project.buildings.find(b=>b.levels.some(l=>l.id===input.levelId))!,level=building.levels.find(l=>l.id===input.levelId)!
  const systems:BuildingSystem[]=[]
  for(const requirement of proposal.architecturalRequirements.systems){
    const candidate=candidates.find(c=>c.id===requirement.boundaryId),p=requirement.parameters
    const points=candidate?.points.map(point=>imageToWorld(point,dimensions.width,dimensions.height,input)) || []
    const base={id:`ai_${digest(`${analysisId}:system:${requirement.id}`).slice(0,32)}`,name:requirement.name,levelId:level.id,
      origin:requirement.origin,evidence:requirement.evidence,elevation:p.elevation||0,color:'#899ba5'}
    if(input.options.designMode==='faithful'&&requirement.origin==='inferred')throw new ApiError(422,'ARCHITECTURE_REVIEW_REQUIRED',`Review inferred architecture: ${requirement.name}`)
    let system:unknown
    if(requirement.kind==='typical-floors'){
      if(!p.count||!p.floorHeight)throw new ApiError(422,'ARCHITECTURE_DIMENSIONS_REQUIRED','Repeated floors require an evidenced count and floor height.')
      system={...base,kind:requirement.kind,templateLevelId:level.id,count:p.count,floorHeight:p.floorHeight,detached:{}}
    }else{
      if(!candidate || !p.height)throw new ApiError(422,'ARCHITECTURE_SOURCE_REQUIRED',`${requirement.name} requires its source boundary and height.`)
      if(requirement.kind==='curtain-wall')system={...base,kind:requirement.kind,path:points,height:p.height,bayWidth:p.bayWidth||1.5,transomHeight:p.transomHeight||1.5,depth:p.depth||.12,
        ...(candidate.curve?{curve:{...candidate.curve,center:imageToWorld(candidate.curve.center,dimensions.width,dimensions.height,input),radius:candidate.curve.radius*dimensions.width*input.calibration.metresPerPixel}}:{})}
      if(requirement.kind==='beam')system={...base,kind:requirement.kind,start:points[0],end:points.at(-1),height:p.height,width:p.width||.25}
      if(requirement.kind==='core'||requirement.kind==='shaft')system={...base,kind:requirement.kind,polygon:points,height:p.height,thickness:p.thickness||.2}
      if(requirement.kind==='void')system={...base,kind:requirement.kind,polygon:points,height:p.height,role:requirement.role||'atrium'}
      if(requirement.kind==='massing')system={...base,kind:requirement.kind,polygon:points,holes:[],height:p.height,role:requirement.role||'wing'}
    }
    const result=systemSchema.safeParse(system)
    if(!result.success)throw new ApiError(422,'ARCHITECTURE_INVALID',`Review the architectural parameters for ${requirement.name}.`)
    systems.push(result.data)
  }
  building.systems={version:1,typology:proposal.architecturalRequirements.typology,systems:[...(building.systems?.systems.filter(s=>s.origin==='user-selected'||s.levelId!==level.id)||[]),...systems]}
  const issues=validateSystems(building)
  if(issues.length)throw new ApiError(422,'ARCHITECTURE_INVALID',issues.join(' · '))
}
