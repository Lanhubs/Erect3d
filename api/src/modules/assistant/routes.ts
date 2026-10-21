import {Hono} from 'hono'
import {z} from 'zod'
import type {ApiEnv} from '../../middleware/types'
import type {Services} from '../../config/services'
import {body,param,parse} from '../../contracts/http'
import {assistantMessage,assistantApply} from '../../contracts/assistant'
import {authorize} from '../../security/permissions'
import {ApiError} from '../../security/errors'
import {requestAssistant} from './requests'
import {ownedRun,applyAssistant,cancelAssistant} from './review'
export function assistantRoutes(services:Services){
  const {db,config}=services,routes=new Hono<ApiEnv>()
  routes.get('/:projectId/assistant/thread',async c=>{
    const projectId=param(c,'projectId'),actor=c.get('actor');await authorize(db,actor,projectId)
    const cursor=parse(z.string().regex(/^\d+$/).optional(),c.req.query('cursor'))
    const [thread]=await db`SELECT id FROM assistant_threads WHERE project_id=${projectId} AND actor_id=${actor.id}`
    if(!thread)return c.json({messages:[],run:null,nextCursor:null})
    const rows=await db`SELECT id::text,run_id,role,content,created_at FROM assistant_messages WHERE thread_id=${thread.id}
      AND (${cursor||null}::bigint IS NULL OR id<${cursor||null}::bigint) ORDER BY id DESC LIMIT 31`
    const [run]=await db`SELECT * FROM assistant_runs WHERE thread_id=${thread.id} ORDER BY created_at DESC,id DESC LIMIT 1`
    const messages=rows.slice(0,30)
    return c.json({messages:messages.toReversed(),run:run||null,nextCursor:rows.length>30?messages.at(-1)?.id:null})
  })
  routes.post('/:projectId/assistant/messages',async c=>{
    if(!services.editingProvider)throw new ApiError(503,'ASSISTANT_UNAVAILABLE','The design assistant has not been configured')
    const result=await requestAssistant(db,config,c.get('actor'),param(c,'projectId'),await body(c,assistantMessage),c.req.header('Idempotency-Key'),c.get('requestId'))
    services.requestedAnalysis?.start(result.runId)
    return c.json(result,202)
  })
  routes.get('/:projectId/assistant/runs/:runId',async c=>{
    const run=await ownedRun(db,c.get('actor'),param(c,'projectId'),param(c,'runId'))
    const [project]=await db`SELECT revision FROM projects WHERE id=${run.project_id}`
    return c.json({...run,...(run.status==='ready'&&Number(project.revision)!==Number(run.base_revision)?{status:'stale',progress:'The model changed. Prepare a new proposal.'}:{})})
  })
  routes.post('/:projectId/assistant/runs/:runId/cancel',async c=>c.json(await cancelAssistant(db,c.get('actor'),param(c,'projectId'),param(c,'runId'))))
  routes.post('/:projectId/assistant/runs/:runId/apply',async c=>c.json(await applyAssistant(db,config,c.get('actor'),param(c,'projectId'),param(c,'runId'),await body(c,assistantApply))))
  return routes
}
