import type {Database} from '../db/connection'
import type {Config} from '../config/env'
import type {Job} from '../jobs/queue'
import type {AnalysisJob,Intelligence} from '../contracts/analysis'
import {intelligenceSchema} from '../contracts/analysis'
import type {Project} from '../contracts/project'
import type {IntelligenceInput,PlanIntelligenceProvider} from '../modules/ai/provider'
import {ProviderFailure} from '../modules/ai/provider'
import {parse} from '../contracts/http'
import {ApiError} from '../security/errors'
import {assertLease} from '../jobs/lease'
import {mergeModelRepair} from './merge-model-repair'
import {buildReconstruction} from '../modules/plan-analysis/reconstruction'
import {reconstructionScale} from '../modules/plan-analysis/reconstruction-scale'
import {buildableCandidates,modelQuality,type ModelQuality} from '../modules/plan-analysis/quality'
import {sourceEnvelope} from './source-envelope'
import {alignOpeningHosts} from './opening-hosts'
import {repairContext,needsSourceRepair} from './repair-context'
import {assertBuildingScope} from '../modules/ai/building-scope'
import {analysisProgress} from './analysis-progress'

export function inspectReconstruction(project:Project,input:AnalysisJob,id:string,proposal:Intelligence,dimensions:{width:number;height:number}):ModelQuality {
  let candidates=buildableCandidates(proposal.candidates)
  let diagnostic=proposal
  const errors:ModelQuality['issues']=[]
  // Collect independent element errors for ONE source repair. Temporary omission
  // is diagnostic only: the original proposal remains blocked and is never applied.
  for(let check=0;check<20;check++){
    try {
      const compiled=buildReconstruction(project,input,id,diagnostic,candidates,dimensions,true)
      const quality=modelQuality(proposal,compiled,input.levelId,input.calibration.method==='manual',dimensions,['full','fixtures','furniture'].includes(input.options.mode))
      return errors.length?{status:'blocked',issues:[...errors,...quality.issues].slice(0,100)}:quality
    }catch(error){
      const candidate=error instanceof ApiError?candidates.find(item=>error.message.includes(`Review ${item.id}:`)):undefined
      errors.push({code:error instanceof ApiError?error.code:'MODEL_INVALID',severity:'error',candidateId:candidate?.id,
        message:error instanceof ApiError?error.message:'The generated geometry could not be compiled.'})
      if(!candidate)break
      candidates=candidates.filter(item=>item.id!==candidate.id)
      if(candidate.kind==='architectural-boundary'&&diagnostic.architecturalRequirements)diagnostic={...diagnostic,
        architecturalRequirements:{...diagnostic.architecturalRequirements,systems:diagnostic.architecturalRequirements.systems.filter(system=>system.boundaryId!==candidate.id)}}
    }
  }
  return {status:'blocked',issues:[...errors,...modelQuality(proposal).issues].slice(0,100)}
}
export async function validatedReconstruction(db:Database,config:Config,job:Job,input:AnalysisJob,
  project:Project,proposal:Intelligence,provider:PlanIntelligenceProvider,source:IntelligenceInput,signal:AbortSignal) {
  assertBuildingScope(proposal)
  const dimensions={width:source.width,height:source.height}
  let quality=inspectReconstruction(project,input,job.id,proposal,dimensions)
  const direct=input.options.engine==='backend' && input.options.purpose==='rebuild' && input.options.strategy!=='detailed'
  for(let attempt=1;attempt<=(direct?1:2) && (quality.status==='blocked'||direct&&needsSourceRepair(quality));attempt++) {
    const pass=`validated-model-repair-${attempt}`
    await analysisProgress(db,job,pass,['reconstruct-model','model-validation',pass],['reconstruct-model'])
    const [cached]=await db`SELECT proposal FROM analysis_passes WHERE analysis_id=${job.id} AND pass=${pass}`
    let repaired:Intelligence
    if (cached) repaired=parse(intelligenceSchema,cached.proposal)
    else {
      const callId=await db.begin(async tx=>{
        await assertLease(tx,job)
        const [call]=await tx`INSERT INTO ai_calls(analysis_id,actor_id,model,pass) VALUES (${job.id},${job.actor_id},${source.model},${pass}) RETURNING id`
        return call.id
      })
      let response
      try {
        response=await provider.interpret({...repairContext(source,proposal,quality),pass:'validated-model-repair'},
          AbortSignal.any([signal,AbortSignal.timeout(config.AI_TIMEOUT_MS)]))
        repaired=parse(intelligenceSchema,response.proposal)
      } catch(error) {
        await db`UPDATE ai_calls SET failure_code=${error instanceof ProviderFailure?error.code:'AI_SCHEMA_MISMATCH'} WHERE id=${callId}`
        if(signal.aborted && signal.reason?.name!=='TimeoutError')throw error
        // The completed interpretation remains reviewable when an optional repair is unavailable.
        return {proposal,quality:{...quality,issues:[...quality.issues,{code:'REPAIR_UNAVAILABLE',severity:'warning' as const,
          message:'Automatic model repair was unavailable. The completed interpretation is retained; correct the indicated geometry before applying.'}]}}
      }
      await db.begin(async tx=>{
        await assertLease(tx,job)
        await tx`INSERT INTO analysis_passes(analysis_id,pass,proposal,usage) VALUES (${job.id},${pass},${repaired}::jsonb,${response.usage || {}}::jsonb) ON CONFLICT DO NOTHING`
        await tx`UPDATE ai_calls SET usage=${response.usage || {}}::jsonb WHERE id=${callId}`
      })
    }
    const scale=reconstructionScale(input,proposal,source.width,source.height)
    proposal=mergeModelRepair(proposal,repaired,quality,input.options.mode,{...dimensions,metresPerPixel:scale.calibration.metresPerPixel})
    proposal=alignOpeningHosts(await sourceEnvelope(proposal,source.bytes),source.width,source.height)
    quality=inspectReconstruction(project,input,job.id,proposal,dimensions)
  }
  return {proposal,quality}
}
