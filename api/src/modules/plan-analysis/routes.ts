import { Hono } from 'hono'
import { z } from 'zod'
import type { Database } from '../../db/connection'
import type { Config } from '../../config/env'
import type { ApiEnv } from '../../middleware/types'
import { analysisRequest, candidateSchema, intelligenceSchema } from '../../contracts/analysis'
import { body, param, parse } from '../../contracts/http'
import { id, revision } from '../../contracts/primitives'
import { authorize } from '../../security/permissions'
import { ApiError, requireValue } from '../../security/errors'
import { requestAnalysis } from './service'
import { loadDocument } from '../projects/documents'
import { convertCandidates } from './conversion'
import { documentChanges } from '../../../client/diff'
import { commitInTransaction } from '../projects/operations'
import { audit } from '../audit/service'
import { checksum } from '../../security/tokens'
const review = z.object({ operationId: id, baseRevision: revision,
  candidateIds: z.array(id).min(1).max(1000), edits: z.array(candidateSchema).max(1000).default([]) }).strict()
export function analysisRoutes(db: Database, config: Config) {
  const routes = new Hono<ApiEnv>()
  routes.post('/projects/:projectId/analysis', async context => context.json(await requestAnalysis(db, config,
    context.get('actor'), param(context,'projectId'),await body(context,analysisRequest),context.req.header('Idempotency-Key'),context.get('requestId')),202))
  routes.get('/analysis/:analysisId', async context => {
    const analysisId = param(context,'analysisId')
    const [row] = await db`SELECT a.*,j.status AS job_status,j.failure_code,j.attempts,j.started_at,j.completed_at FROM analyses a JOIN jobs j ON j.id=a.id WHERE a.id=${analysisId}`
    requireValue(row)
    await authorize(db,context.get('actor'),row.project_id)
    return context.json(row)
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
  routes.post('/analysis/:analysisId/accept', async context => {
    const analysisId = param(context,'analysisId'), actor = context.get('actor'), input = await body(context,review)
    const result = await db.begin(async tx => {
      const [row] = await tx`SELECT a.*,j.payload FROM analyses a JOIN jobs j ON j.id=a.id WHERE a.id=${analysisId} FOR UPDATE OF a`
      requireValue(row)
      await authorize(tx,actor,row.project_id,'edit')
      if (row.status==='accepted' && row.review_operation_id===input.operationId && row.review_hash===checksum(input)) {
        return { revision:Number(row.accepted_revision),operationId:input.operationId }
      }
      if (row.status !== 'ready') throw new ApiError(409,'ANALYSIS_STATE','Only completed proposals can be accepted once')
      const proposal = parse(intelligenceSchema,row.result.proposal), original = new Map(proposal.candidates.map(candidate => [candidate.id,candidate]))
      for (const edit of input.edits) {
        if (!original.has(edit.id)) throw new ApiError(422,'INVALID_CANDIDATE','Edited candidate is not part of this analysis')
        original.set(edit.id,edit)
      }
      const chosen = input.candidateIds.map(id => requireValue(original.get(id),'Candidate not found'))
      if (new Set(input.candidateIds).size !== chosen.length) throw new ApiError(422,'DUPLICATE_CANDIDATE','Select each candidate once')
      const current = await loadDocument(tx,row.project_id), source = parse(analysisRequest,row.payload)
      const level = current.document.buildings.flatMap(building => building.levels).find(level => level.id === source.levelId)
      if (level?.sourceId !== source.sourceId || checksum(level.calibration)!==checksum(source.calibration) ||
        checksum(level.alignment || { x:0,z:0 })!==checksum(source.alignment || { x:0,z:0 })) {
        throw new ApiError(409,'SOURCE_CHANGED','The source or calibration changed; request fresh analysis')
      }
      const converted = convertCandidates(current.document,source,analysisId,chosen,row.result.dimensions)
      const changes = documentChanges(current.document,converted)
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
