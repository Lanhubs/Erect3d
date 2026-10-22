import {afterAll,beforeAll,expect,test} from 'bun:test'
import {account,createProject,harness,request,type Account} from './helpers'
import {Worker} from '../src/workers/runner'
import type {EditingProvider} from '../src/modules/assistant/provider'
import {loadDocument} from '../src/modules/projects/documents'
let mode='edit',calls=0
const provider:EditingProvider={async next(_model,history){
  calls++
  if(mode==='clarify')return {content:{role:'model',parts:[{text:'Which meeting room?'}]},text:'Which meeting room?'}
  const context=JSON.parse(history[0].parts![0].text!)
  if(!history.some(c=>c.parts?.some(p=>p.functionResponse)))return {content:{role:'model',parts:[{thoughtSignature:'saved-signature',functionCall:{id:'inspect',name:'inspect_model',args:{}}}]},text:''}
  if(!history.some(c=>c.parts?.some(p=>p.functionCall?.name==='edit_model'))){
    expect(history.some(c=>c.parts?.some(p=>p.thoughtSignature==='saved-signature'))).toBe(true)
    return {content:{role:'model',parts:[{functionCall:{id:'edit',name:'edit_model',args:{commands:[{action:'set',kind:'level',id:context.activeLevelId,properties:JSON.stringify(mode==='invalid'?{elevation:1e12}:{name:'Updated ground floor'})}]}}}]},text:''}
  }
  return {content:{role:'model',parts:[{text:'The floor name is ready to preview.'}]},text:'The floor name is ready to preview.',usage:{totalTokens:25}}
}}
const h=harness({editingProvider:provider}),worker=new Worker(h.db,h.config,undefined,undefined,h.metrics,provider)
let user:Account,other:Account
beforeAll(async()=>{user=await account(h.app);other=await account(h.app)})
afterAll(async()=>{worker.stop();h.limits.close();await h.db.close()})
async function start(){
  const project=await createProject(h.app,user),b=project.buildings[0],l=b.levels[0],key=crypto.randomUUID()
  const input={message:'Rename this floor',baseRevision:0,scope:{mode:'level',buildingId:b.id,levelId:l.id}}
  const response=await request(h.app,user,`/projects/${project.id}/assistant/messages`,'POST',input,{'Idempotency-Key':key})
  expect(response.status).toBe(202)
  return {project,input,key,id:(await response.json()).runId as string}
}
async function run(id:string,projectId:string){await worker.runOnce(id);return (await request(h.app,user,`/projects/${projectId}/assistant/runs/${id}`)).json()}
test('model-only proposals preserve SDK history and live document, charge once, apply idempotently and reopen',async()=>{
  mode='edit';calls=0
  expect((await (await h.app.request('/ready')).json()).capabilities.assistant).toBe(true)
  const s=await start(),again=await request(h.app,user,`/projects/${s.project.id}/assistant/messages`,'POST',s.input,{'Idempotency-Key':s.key})
  expect((await again.json()).runId).toBe(s.id)
  const result=await run(s.id,s.project.id)
  expect(result.status).toBe('ready');expect(calls).toBe(3)
  expect(typeof result.base_revision).toBe('number')
  expect((await loadDocument(h.db,s.project.id)).document).toEqual(s.project)
  expect(result.proposal.document.buildings[0].levels[0].name).toBe('Updated ground floor')
  const [count]=await h.db`SELECT count(*)::int AS n FROM ai_usage WHERE job_id=${s.id}`;expect(count.n).toBe(1)
  const op={operationId:crypto.randomUUID(),baseRevision:0},path=`/projects/${s.project.id}/assistant/runs/${s.id}/apply`
  expect((await request(h.app,user,path,'POST',op)).status).toBe(200)
  expect((await request(h.app,user,path,'POST',op)).status).toBe(200)
  const saved=await loadDocument(h.db,s.project.id);expect(saved.revision).toBe(1);expect(saved.document.buildings[0].levels[0].name).toBe('Updated ground floor')
  expect((await request(h.app,user,`/projects/${s.project.id}/assistant/runs/${s.id}/cancel`,'POST')).status).toBe(409)
})
test('history and progress are private even to another project editor',async()=>{
  mode='edit';const s=await start()
  expect((await request(h.app,user,`/projects/${s.project.id}/members/${other.id}`,'PUT',{role:'EDITOR'})).status).toBe(204)
  expect((await (await request(h.app,other,`/projects/${s.project.id}/assistant/thread`)).json()).messages).toHaveLength(0)
  expect((await request(h.app,other,`/projects/${s.project.id}/assistant/runs/${s.id}`)).status).toBe(404)
  expect((await request(h.app,other,`/projects/${s.project.id}/jobs/${s.id}`)).status).toBe(404)
  expect((await request(h.app,other,`/projects/${s.project.id}/assistant/runs/${s.id}/apply`,'POST',{operationId:crypto.randomUUID(),baseRevision:0})).status).toBe(404)
  await run(s.id,s.project.id)
  const events=await h.db`SELECT recipient_user_id FROM realtime_events WHERE project_id=${s.project.id} AND type='assistant.progress'`
  expect(events.length).toBeGreaterThan(0);expect(events.every((e:{recipient_user_id:string})=>e.recipient_user_id===user.id)).toBe(true)
})
test('cancellation, clarification, stale revisions and invalid commands never overwrite the model',async()=>{
  const cancelled=await start();expect((await request(h.app,user,`/projects/${cancelled.project.id}/assistant/runs/${cancelled.id}/cancel`,'POST')).status).toBe(200)
  expect(await worker.runOnce(cancelled.id)).toBe(false)
  mode='clarify';const clarification=await start();expect((await run(clarification.id,clarification.project.id)).status).toBe('clarification')
  mode='edit';const stale=await start();await run(stale.id,stale.project.id)
  const changed=await request(h.app,user,`/projects/${stale.project.id}/operations`,'POST',{operationId:crypto.randomUUID(),baseRevision:0,type:'document.patch',entityId:stale.project.id,payload:{changes:[{action:'put',path:['name'],value:'Manual change'}]}})
  expect(changed.status).toBe(200)
  expect((await request(h.app,user,`/projects/${stale.project.id}/assistant/runs/${stale.id}/apply`,'POST',{operationId:crypto.randomUUID(),baseRevision:0})).status).toBe(409)
  mode='invalid';const invalid=await start();expect((await run(invalid.id,invalid.project.id)).status).toBe('clarification')
  expect((await loadDocument(h.db,invalid.project.id)).revision).toBe(0)
})
test('viewer access, foreign plan references and stale request bases are rejected',async()=>{
  mode='edit';const s=await start()
  await request(h.app,user,`/projects/${s.project.id}/members/${other.id}`,'PUT',{role:'VIEWER'})
  const path=`/projects/${s.project.id}/assistant/messages`
  expect((await request(h.app,other,path,'POST',s.input)).status).toBe(403)
  expect((await request(h.app,user,path,'POST',{...s.input,baseRevision:10})).status).toBe(409)
  expect((await request(h.app,user,path,'POST',{...s.input,planSourceIds:['another-project-source']})).status).toBe(422)
})
