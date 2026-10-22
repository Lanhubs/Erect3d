import {afterAll,expect,test} from 'bun:test'
import {account,createProject,harness,request} from './helpers'
import {Worker} from '../src/workers/runner'
import type {EditingProvider} from '../src/modules/assistant/provider'
const h=harness({editingProvider:{async next(){throw Error('Not executed through the API')}}})
afterAll(async()=>{h.limits.close();await h.db.close()})
test('the runner bounds tool calls, rounds and timeout without publishing a proposal',async()=>{
  const user=await account(h.app)
  for(const mode of ['tools','rounds','timeout']){
    const p=await createProject(h.app,user),b=p.buildings[0],l=b.levels[0]
    const response=await request(h.app,user,`/projects/${p.id}/assistant/messages`,'POST',{message:'Review the model',baseRevision:0,scope:{mode:'level',buildingId:b.id,levelId:l.id}})
    const id=(await response.json()).runId;let calls=0
    const provider:EditingProvider={async next(_model,_history,_tools,signal){
      calls++
      if(mode==='timeout'){await new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));throw Error('Unreachable')}
      return {content:{role:'model',parts:Array.from({length:mode==='tools'?13:1},()=>({functionCall:{name:'inspect_model',args:{}}}))},text:''}
    }}
    await new Worker(h.db,{...h.config,AI_TIMEOUT_MS:1000},undefined,undefined,h.metrics,provider).runOnce(id)
    const result=await (await request(h.app,user,`/projects/${p.id}/assistant/runs/${id}`)).json()
    expect(result.status).toBe('failed');expect(result.proposal).toBeNull()
    expect(result.failure_code).toBe(mode==='timeout'?'ASSISTANT_TIMEOUT':'ASSISTANT_LIMIT');expect(calls).toBeLessThanOrEqual(3)
  }
},15000)
test('one pending request and the existing account quota are enforced',async()=>{
  const user=await account(h.app),p=await createProject(h.app,user),b=p.buildings[0],l=b.levels[0]
  const path=`/projects/${p.id}/assistant/messages`,input={message:'Review',baseRevision:0,scope:{mode:'level',buildingId:b.id,levelId:l.id}}
  const first=await request(h.app,user,path,'POST',input),id=(await first.json()).runId
  expect((await request(h.app,user,path,'POST',input)).status).toBe(409)
  await request(h.app,user,`/projects/${p.id}/assistant/runs/${id}/cancel`,'POST')
  const previous=h.config.AI_DAILY_LIMIT;h.config.AI_DAILY_LIMIT=1
  try{expect((await request(h.app,user,path,'POST',input)).status).toBe(429)}finally{h.config.AI_DAILY_LIMIT=previous}
})
test('invalid proposed geometry gets one repair against the working copy and remains unapplied',async()=>{
  const user=await account(h.app),p=await createProject(h.app,user),b=p.buildings[0],l=b.levels[0]
  const response=await request(h.app,user,`/projects/${p.id}/assistant/messages`,'POST',{message:'Improve this room',baseRevision:0,scope:{mode:'level',buildingId:b.id,levelId:l.id}})
  const id=(await response.json()).runId;let count=0,roomId=''
  const provider:EditingProvider={async next(_model,history){
    count++
    if(count===2){const result=history.flatMap(c=>c.parts||[]).find(p=>p.functionResponse?.name==='edit_model')?.functionResponse?.response as any;roomId=result.result.results[0].id;return {content:{role:'model',parts:[{text:'Ready for validation'}]},text:'Ready for validation'}}
    if(count===3)expect(JSON.stringify(history)).toContain('Validation failed')
    const polygon=count===1?[{x:0,z:0},{x:4,z:4},{x:0,z:4},{x:4,z:0}]:[{x:0,z:0},{x:4,z:0},{x:4,z:4},{x:0,z:4}]
    const command=count===1?{action:'create',kind:'room',levelId:l.id,properties:JSON.stringify({name:'Studio',material:'tile',polygon})}:{action:'set',kind:'room',id:roomId,properties:JSON.stringify({polygon})}
    return {content:{role:'model',parts:[{functionCall:{name:'edit_model',args:{commands:[command]}}}]},text:''}
  }}
  await new Worker(h.db,h.config,undefined,undefined,h.metrics,provider).runOnce(id)
  const result=await (await request(h.app,user,`/projects/${p.id}/assistant/runs/${id}`)).json()
  expect(result.status).toBe('ready');expect(count).toBe(3)
  const [saved]=await h.db`SELECT revision FROM projects WHERE id=${p.id}`;expect(Number(saved.revision)).toBe(0)
})
