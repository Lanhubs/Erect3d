import { Hono } from 'hono'
import { z } from 'zod'
import type { Database } from '../../db/connection'
import type { Config } from '../../config/env'
import type { ApiEnv } from '../../middleware/types'
import { analysisJob, analysisRequest, candidateSchema, intelligenceSchema } from '../../contracts/analysis'
import { body, param, parse } from '../../contracts/http'
import { id, revision } from '../../contracts/primitives'
import { authorize } from '../../security/permissions'
import { ApiError, requireValue } from '../../security/errors'
import { requestAnalysis } from './service'
import { loadDocument } from '../projects/documents'
import { compactDocumentChanges } from '../../../client/compact-diff'
import { commitInTransaction } from '../projects/operations'
import { audit,emit } from '../audit/service'
import { checksum } from '../../security/tokens'
import { analysisPasses } from '../ai/passes'
import { reviewModel } from './review-model'
import { promptVersion } from '../ai/gemini'
const review = z.object({ operationId: id, baseRevision: revision,
  candidateIds: z.array(id).max(1000), edits: z.array(candidateSchema).max(1000).default([]), allowConfirmedIds: z.array(id).max(1000).default([]),
  designIds: z.array(id).max(20).default([]),replaceLevel:z.boolean().default(false) }).strict()
export function analysisRoutes(db: Database, config: Config, startRequested?:(id:string)=>void) {
  const routes = new Hono<ApiEnv>()
  routes.get('/projects/:projectId/analysis',async context=>{
    const projectId=param(context,'projectId'),query=parse(z.object({sourceId:id,levelId:id}).strict(),context.req.query())
    await authorize(db,context.get('actor'),projectId)
    const [row]=await db`SELECT a.id AS "analysisId",a.status FROM analyses a JOIN jobs j ON j.id=a.id JOIN projects p ON p.id=a.project_id
      WHERE a.project_id=${projectId} AND j.payload->>'sourceId'=${query.sourceId} AND j.payload->>'levelId'=${query.levelId}
      AND a.prompt_version=${promptVersion} AND a.status IN ('pending','ready') AND (j.payload->'context'->>'revision')::bigint=p.revision ORDER BY a.created_at DESC LIMIT 1`
    return context.json(row || null)
  })
  routes.post('/projects/:projectId/analysis', async context => {
    const result=await requestAnalysis(db,config,context.get('actor'),param(context,'projectId'),
      await body(context,analysisRequest),context.req.header('Idempotency-Key'),context.get('requestId'))
    startRequested?.(result.analysisId)
    return context.json(result,202)
  })
  routes.post('/analysis/:analysisId/resume',async context=>{
    const analysisId=param(context,'analysisId')
    const [row]=await db`SELECT project_id,status,options FROM analyses WHERE id=${analysisId}`
    await authorize(db,context.get('actor'),requireValue(row).project_id,'edit')
    if (row.status!=='pending' || !row.options.cloudConsent) throw new ApiError(409,'ANALYSIS_STATE','Only a pending, authorized analysis can be resumed')
    startRequested?.(analysisId)
    return context.json({analysisId,status:row.status},202)
  })
  routes.get('/analysis/:analysisId', async context => {
    const analysisId = param(context,'analysisId')
    const [row] = await db`SELECT a.*,j.status AS job_status,j.failure_code,j.attempts,j.started_at,j.completed_at,j.payload->'context'->>'revision' AS model_revision FROM analyses a JOIN jobs j ON j.id=a.id WHERE a.id=${analysisId}`
    requireValue(row)
    await authorize(db,context.get('actor'),row.project_id)
    const completed = await db`SELECT pass FROM analysis_passes WHERE analysis_id=${analysisId} ORDER BY created_at`
    const stages = analysisPasses(row.options.mode, row.options.complex, row.options.architectureCompletion,row.options.engine==='backend',row.options.purpose==='rebuild' && row.options.strategy!=='detailed')
    return context.json({ ...row, currentPromptVersion:promptVersion, progress: { completed: completed.map((item: { pass: string }) => item.pass),
      stages:[...stages,...completed.map((item:{pass:string})=>item.pass).filter((pass:string)=>pass.startsWith('validated-model-repair'))], current: stages.find(stage => !completed.some((item: { pass: string }) => item.pass === stage)) || (row.job_status==='running'?'model-validation':'review') } })
  })
  routes.post('/analysis/:analysisId/cancel', async context => {
    const analysisId = param(context,'analysisId'), actor = context.get('actor')
    await db.begin(async tx => {
      await tx`SELECT id FROM jobs WHERE id=${analysisId} FOR UPDATE`
      const [row] = await tx`SELECT project_id,status FROM analyses WHERE id=${analysisId} FOR UPDATE`
      await authorize(tx,actor,requireValue(row).project_id,'edit')
      if (row.status!=='pending') throw new ApiError(409,'ANALYSIS_STATE','Only pending analysis can be cancelled; completed proposals can be rejected')
      await tx`UPDATE jobs SET status='cancelled',completed_at=now() WHERE id=${analysisId} AND status IN ('queued','running')`
      await tx`UPDATE analyses SET status='cancelled' WHERE id=${analysisId} AND status='pending'`
      await audit(tx,actor,row.project_id,'analysis.cancelled',context.get('requestId'),{ analysisId })
      await emit(tx,row.project_id,'analysis.cancelled',{analysisId,status:'cancelled'})
    })
    return context.body(null,204)
  })
  routes.post('/analysis/:analysisId/reject', async context => {
    const analysisId = param(context,'analysisId'), actor = context.get('actor')
    await db.begin(async tx => {
      const [row] = await tx`SELECT project_id,status FROM analyses WHERE id=${analysisId} FOR UPDATE`
      await authorize(tx,actor,requireValue(row).project_id,'edit')
      if (row.status !== 'ready') throw new ApiError(409,'ANALYSIS_STATE','Only completed proposals can be reviewed')
      await tx`UPDATE analyses SET status='rejected',reviewed_by=${actor.id} WHERE id=${analysisId}`
      await audit(tx,actor,row.project_id,'analysis.rejected',context.get('requestId'),{ analysisId })
    })
    return context.body(null,204)
  })
  for (const action of ['preview','accept'] as const) routes.post(`/analysis/:analysisId/${action}`, async context => {
    const analysisId = param(context,'analysisId'), actor = context.get('actor'), input = await body(context,review)
    const result = await db.begin(async tx => {
      const [row] = await tx`SELECT a.*,j.payload FROM analyses a JOIN jobs j ON j.id=a.id WHERE a.id=${analysisId} FOR UPDATE OF a`
      requireValue(row)
      await authorize(tx,actor,row.project_id,'edit')
      const {replaceLevel,...legacyInput}=input
      if (action==='accept' && row.status==='accepted' && row.review_operation_id===input.operationId &&
        (row.review_hash===checksum(input) || !replaceLevel && row.review_hash===checksum(legacyInput))) {
        return { revision:Number(row.accepted_revision),operationId:input.operationId }
      }
      if (row.status !== 'ready') throw new ApiError(409,'ANALYSIS_STATE','Only completed proposals can be accepted once')
      const proposal = parse(intelligenceSchema,row.result.proposal), original = new Map(proposal.candidates.map(candidate => [candidate.id,candidate]))
      for (const edit of input.edits) {
        if (!original.has(edit.id)) throw new ApiError(422,'INVALID_CANDIDATE','Edited candidate is not part of this analysis')
        if (edit.targetId !== original.get(edit.id)?.targetId) throw new ApiError(422,'INVALID_TARGET','A reviewed correction cannot change its target identity')
        if (edit.action !== original.get(edit.id)?.action) throw new ApiError(422,'INVALID_ACTION','A reviewed candidate cannot change between correction and removal')
        original.set(edit.id,edit)
      }
      const chosen = input.candidateIds.map(id => requireValue(original.get(id),'Candidate not found'))
      if (new Set(input.candidateIds).size !== chosen.length) throw new ApiError(422,'DUPLICATE_CANDIDATE','Select each candidate once')
      const targets = chosen.flatMap(candidate => candidate.targetId ? [candidate.targetId] : [])
      if (new Set(targets).size !== targets.length) throw new ApiError(422,'DUPLICATE_TARGET','Select one correction per existing element')
      const current = await loadDocument(tx,row.project_id), source = parse(analysisJob,row.payload)
      const level = current.document.buildings.flatMap(building => building.levels).find(level => level.id === source.levelId)
      if (level?.sourceId !== source.sourceId || checksum(level.calibration || current.document.calibration)!==checksum(source.calibration) ||
        checksum(level.alignment || { x:0,z:0 })!==checksum(source.alignment || { x:0,z:0 })) {
        throw new ApiError(409,'SOURCE_CHANGED','The source or calibration changed; request fresh analysis')
      }
      if (action==='preview' && current.revision!==input.baseRevision) throw new ApiError(409,'REVISION_CONFLICT','Sync the latest model before previewing')
      const designs = input.designIds.map(id => requireValue(proposal.designs?.find(design => design.id === id),'Design proposal not found'))
      if (!chosen.length && !designs.length) throw new ApiError(422,'REVIEW_EMPTY','Select geometry or a design proposal')
      const compiled=reviewModel(current.document,source,analysisId,proposal,chosen,row.result.dimensions,designs,
        action==='preview'?chosen.map(item=>item.id):input.allowConfirmedIds,action==='preview'||input.replaceLevel,current.revision)
      if (action==='preview') return {...compiled,revision:current.revision}
      const converted=compiled.document
      const changes = compactDocumentChanges(current.document,converted)
      if (!changes.length || changes.length>512) throw new ApiError(422,'REVIEW_BATCH_SIZE','Accept a smaller set of candidates')
      const accepted = await commitInTransaction(tx,config,actor,row.project_id,{ operationId:input.operationId,baseRevision:input.baseRevision,
        type:'document.patch',entityId:source.levelId,payload:{ changes } })
      await tx`UPDATE analyses SET status='accepted',reviewed_by=${actor.id},accepted_revision=${accepted.revision},
        review_operation_id=${input.operationId},review_hash=${checksum(input)} WHERE id=${analysisId}`
      await audit(tx,actor,row.project_id,'analysis.accepted',context.get('requestId'),{ analysisId,candidateIds:input.candidateIds,revision:accepted.revision })
      return accepted
    })
    return context.json(result)
  })
  return routes
}
