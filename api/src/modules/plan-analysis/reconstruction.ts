import {applyArchitecturalSystems} from './architectural-systems'
import type { AnalysisInput,Candidate,Intelligence } from '../../contracts/analysis'
import type { Project } from '../../contracts/project'
import { projectSchema } from '../../contracts/project'
import { parse } from '../../contracts/http'
import { ApiError } from '../../security/errors'
import { digest } from '../../security/tokens'
import { convertCandidates,imageToWorld } from './conversion'
import { validateGeometry } from '../projects/geometry-validation'
import { reconstructionScale } from './reconstruction-scale'
import { roofRegions } from '../../../../client/src/geometry/roofRegions'
import { generatedRoof } from '../../../../client/src/domain/roofDesign'
import { defaultRoof } from '../../../../client/src/domain/types'
import { repairGeneratedFence } from '../../../../client/src/geometry/site'
import { validateFootprint } from './footprint-validation'
import {inSourceRegion} from '../../workers/source-region'
import {newSlab} from '../../../../client/src/domain/levels'

export function buildReconstruction(project:Project,input:AnalysisInput,analysisId:string,proposal:Intelligence,
  candidates:Candidate[],dimensions:{width:number;height:number},replaceLevel=false) {
  const rebuilding=input.options.purpose==='rebuild',document=structuredClone(project)
  const owners=new Set(proposal.architecturalRequirements?.systems.map(s=>s.boundaryId))
  const unowned=candidates.find(c=>c.kind==='architectural-boundary'&&!owners.has(c.id))
  if(unowned)throw new ApiError(422,'ARCHITECTURE_OWNER_REQUIRED',`Review ${unowned.id}: this outline needs a named semantic system with boundaryId=${unowned.id}; it cannot become an unowned mesh.`)
  const typology=proposal.architecturalRequirements?.typology||proposal.understanding?.buildingType||'unknown'
  if(['arena','stadium'].includes(typology))throw new ApiError(422,'BUILDING_TYPE_UNSUPPORTED','Arena and stadium reconstruction is no longer supported. Use a building floor plan.')
  const building=document.buildings.find(item=>item.levels.some(level=>level.id===input.levelId))!
  const level=building?.levels.find(item=>item.id===input.levelId)
  if (!level || level.locked) throw new ApiError(409,'LEVEL_LOCKED','Target level is unavailable or locked')
  if (rebuilding) {
    const outside=candidates.find(c=>!inSourceRegion(c,input.options.region))
    if(outside)throw new ApiError(422,'OUTSIDE_SOURCE_REGION',`Review ${outside.id}: geometry is outside the selected floor-plan area.`)
    validateFootprint(proposal,candidates,dimensions.width,dimensions.height)
    if (!replaceLevel) throw new ApiError(422,'REBUILD_APPROVAL_REQUIRED','Approve replacement of this floor before accepting reconstruction')
    if (candidates.some(item=>item.targetId || item.action)) throw new ApiError(422,'INVALID_REBUILD','Fresh reconstruction cannot target existing entities')
    if (!candidates.some(item=>item.kind==='wall')) throw new ApiError(422,'STRUCTURE_REQUIRED','A house reconstruction needs reviewed walls before 3D can be erected')
    if (building.levels.some(item=>item.stairs?.some(stair=>(stair.toLevelId===level.id || stair.fromLevelId===level.id) && !building.architecture?.generatedIds.includes(stair.id)))) {
      throw new ApiError(422,'CONNECTED_FLOOR','This floor has connected stairs. Use enhancement to preserve its floor connections.')
    }
    const removed=new Set([...level.walls,...level.doors,...level.windows,...(level.passages || []),...level.rooms,...(level.columns || []),...(level.slabs || []),...(level.furniture || [])].map(item=>item.id))
    Object.assign(level,{walls:[],doors:[],windows:[],passages:[],rooms:[],slabs:[],columns:[],stairGuides:[],furniture:[]})
    for (const id of removed) if (document.interpretation) delete document.interpretation[id]
    building.roofSections=building.roofSections?.filter(section=>section.levelId!==level.id || !generatedRoof(section))
  }
  const effective=reconstructionScale(input,proposal,dimensions.width,dimensions.height)
  let converted=convertCandidates(document,effective,analysisId,candidates,dimensions)
  const next=converted.buildings.find(item=>item.id===building.id)!,floor=next.levels.find(item=>item.id===level.id)!
  if (rebuilding) {
    floor.calibration=effective.calibration
    if (next.levels[0].id===floor.id) converted.calibration=effective.calibration
    floor.autoSlab=false
    const envelope=proposal.understanding?.footprint.map(point=>imageToWorld(point,dimensions.width,dimensions.height,effective)) || []
    const voids=(floor.slabs || []).flatMap(slab=>slab.openings.filter(opening=>opening.kind==='void').map(opening=>opening.polygon))
    // Room detections describe finishes. The structural floor must also carry
    // halls and circulation that have no room label; do not leave those floating.
    if(envelope.length>=3){
      const openings=[...new Map((floor.slabs||[]).flatMap(s=>s.openings).map(o=>[o.id,o])).values()]
      floor.slabs=[{...newSlab(envelope,floor.slabThickness),id:`ai_${digest(`${analysisId}:building-slab`).slice(0,32)}`,autoFromWalls:false,openings}]
    }
    const regions=roofRegions(envelope.length>=3?[envelope]:floor.rooms.map(room=>room.polygon),voids)
    const flatDefault=['office','office-tower','apartment','hotel','mixed-use','mall','school','hospital','public','industrial'].includes(typology)
    const roof=next.roof || floor.roof || (flatDefault?{...defaultRoof,shape:'hidden' as const,material:'membrane' as const,pitch:0}:defaultRoof)
    if(!next.roof && !floor.roof){next.roof={...roof};floor.roof={...roof}}
    const manualRoof=next.roofSections?.some(section=>section.levelId===floor.id && !generatedRoof(section))
    if (!manualRoof) {
      next.roofSections=[...(next.roofSections || []),...regions.map((region,index)=>({
        id:`ai_${digest(`${analysisId}:roof:${index}`).slice(0,32)}`,name:'Building roof',levelId:floor.id,
        ...region,automatic:true,followFootprint:true,roof:{...roof}}))]
      floor.autoRoof=regions.length>0
    }
    repairGeneratedFence(next)
  }
  applyArchitecturalSystems(converted,effective,analysisId,proposal,candidates,dimensions)
  const validated=parse(projectSchema,converted)
  validateGeometry(validated)
  return validated
}
