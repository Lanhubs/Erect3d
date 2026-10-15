import {afterAll,beforeAll,expect,test} from 'bun:test'
import sharp from 'sharp'
import {account,createProject,fixture,harness,MemoryStore,request,type Account} from './helpers'
import {createApp} from '../src/app'
import {RequestedAnalysis} from '../src/workers/requested-analysis'
import {bytesHash} from '../src/modules/assets/validation'
import {newId} from '../src/security/tokens'
import {ProviderFailure,type IntelligenceInput} from '../src/modules/ai/provider'
import type {Candidate} from '../src/contracts/analysis'
const store=new MemoryStore(),calls:string[]=[]
const ring=[{x:.1,y:.1},{x:.9,y:.1},{x:.9,y:.9},{x:.1,y:.9}]
let empty=false,repair=false,repairTimeout=false
const provider={async interpret(input:IntelligenceInput){
  calls.push(input.pass)
  if(input.pass==='validated-model-repair' && repairTimeout)throw new ProviderFailure('AI_TIMEOUT',true)
  const candidates:Candidate[]=!empty && input.pass==='structure'?ring.map((point,i)=>({id:`wall-${i}`,kind:'wall',
    points:[point,ring[(i+1)%4]],confidence:.95,evidence:'Visible continuous wall band',uncertainties:[],needsReview:true})):[]
  if (repair && input.pass==='rooms-labels') candidates.push({id:'courtyard',kind:'void',points:ring,confidence:.9,evidence:'Open outdoor area',uncertainties:[],needsReview:true})
  if (repair && input.pass==='validated-model-repair') {
    expect(input.validationIssues?.[0]).toContain('VOID_HOST_REQUIRED')
    candidates.push({id:'entrance',kind:'door',wallId:'wall-0',points:[{x:.3,y:.1},{x:.4,y:.1}],confidence:.95,evidence:'Visible entrance',uncertainties:[],needsReview:true})
  }
  return {proposal:{coordinatesVersion:1 as const,coordinateSystem:'normalized-image-top-left' as const,
    candidates,warnings:[],...(repair && input.pass==='validated-model-repair'?{dispositions:[{candidateId:'courtyard',decision:'reject' as const,reason:'Outdoor courtyard has no containing slab'}]}:{})}}
}}
const h=harness({store,provider,ai:true}),executor=new RequestedAnalysis(h.db,h.config,store,provider,h.metrics)
const app=createApp({...h,requestedAnalysis:executor})
let user:Account,outsider:Account
beforeAll(async()=>{user=await account(app);outsider=await account(app)})
afterAll(async()=>{executor.stop();h.limits.close();await h.db.close()})
async function input() {
  const project=fixture(),level=project.buildings[0].levels[0],sourceId=newId('source'),assetId=newId('asset')
  const bytes=await sharp({create:{width:100,height:100,channels:3,background:'white'}}).png().toBuffer()
  const calibration={a:{x:0,z:0},b:{x:100,z:0},knownMetres:10,metresPerPixel:.1,method:'auto' as const}
  project.sources=[{id:sourceId,name:'Test drawing',mime:'image/png',originalBytes:bytes.length,width:100,height:100}]
  level.sourceId=sourceId;level.calibration=calibration;await createProject(h.app,user,project)
  const key=`private/${project.id}/${assetId}`;await store.write(key,bytes)
  await h.db`INSERT INTO assets(id,project_id,actor_id,object_key,name,mime,size,kind,state,sha256,metadata)
    VALUES (${assetId},${project.id},${user.id},${key},'Test drawing','image/png',${bytes.length},'source','ready',${bytesHash(bytes)},${{width:100,height:100,orientation:1}}::jsonb)`
  return {project,input:{sourceAssetId:assetId,sourceId,levelId:level.id,calibration,
    options:{mode:'full',engine:'backend',purpose:'rebuild',strategy:'detailed',cloudConsent:true}}}
}
async function terminal(id:string) {
  const deadline=Date.now()+10000
  while(Date.now()<deadline) {
    const result=await (await request(app,user,`/analysis/${id}`)).json()
    if (result.status!=='pending') return result
    await Bun.sleep(50)
  }
  throw new Error('Requested reconstruction did not finish')
}
test('authenticated click executes its exact analysis, preserves unrelated queued plans, and cannot be resumed by another account',async()=>{
  const state=await input()
  const previous=await request(h.app,user,`/projects/${state.project.id}/analysis`,'POST',
    {...state.input,options:{...state.input.options,mode:'structure'}})
  const unrelated=(await previous.json()).analysisId
  const unauthorized=await request(app,outsider,`/analysis/${unrelated}/resume`,'POST')
  expect([403,404]).toContain(unauthorized.status)
  const response=await request(app,user,`/projects/${state.project.id}/analysis`,'POST',state.input)
  expect(response.status).toBe(202)
  const id=(await response.json()).analysisId,result=await terminal(id)
  const recent=await request(app,user,`/projects/${state.project.id}/analysis?sourceId=${state.input.sourceId}&levelId=${state.input.levelId}`)
  expect((await recent.json()).analysisId).toBe(id)
  expect([403,404]).toContain((await request(app,outsider,`/projects/${state.project.id}/analysis?sourceId=${state.input.sourceId}&levelId=${state.input.levelId}`)).status)
  expect(result.status).toBe('ready');expect(result.result.proposal.candidates).toHaveLength(4)
  expect(calls).toContain('furniture-fixtures');expect(calls).toContain('model-repair')
  const [other]=await h.db`SELECT status,attempts FROM jobs WHERE id=${unrelated}`
  expect(other.status).toBe('queued');expect(other.attempts).toBe(0)
  const [project]=await h.db`SELECT revision FROM projects WHERE id=${state.project.id}`
  expect(Number(project.revision)).toBe(0) // Result review never overwrites the editor.
})
test('empty backend interpretations fail clearly instead of publishing an empty successful result',async()=>{
  empty=true
  const state=await input(),response=await request(app,user,`/projects/${state.project.id}/analysis`,'POST',state.input)
  const result=await terminal((await response.json()).analysisId)
  expect(result.status).toBe('failed');expect(result.failure_code).toBe('AI_NO_STRUCTURE');expect(result.result).toBeNull()
})
test('compiler failures are fed back to AI and source-supported corrections produce a validated preview',async()=>{
  empty=false;repair=true
  const state=await input(),response=await request(app,user,`/projects/${state.project.id}/analysis`,'POST',state.input)
  const result=await terminal((await response.json()).analysisId)
  expect(result.status).toBe('ready');expect(result.result.quality.status).not.toBe('blocked')
  expect(result.result.proposal.candidates.some((item:Candidate)=>item.kind==='void')).toBe(false)
  expect(result.result.proposal.candidates.find((item:Candidate)=>item.id==='entrance').wallId).toBe('wall-0')
  expect(calls).toContain('validated-model-repair')
})
test('resuming a stored pending request starts the same leased job and repeated resume does not duplicate provider passes',async()=>{
  empty=false;repair=false
  const state=await input(),response=await request(h.app,user,`/projects/${state.project.id}/analysis`,'POST',state.input)
  const id=(await response.json()).analysisId
  expect((await request(app,user,`/analysis/${id}/resume`,'POST')).status).toBe(202)
  expect((await request(app,user,`/analysis/${id}/resume`,'POST')).status).toBe(202)
  expect((await terminal(id)).status).toBe('ready')
  const [counts]=await h.db`SELECT (SELECT count(*)::int FROM ai_calls WHERE analysis_id=${id}) AS calls,
    (SELECT count(*)::int FROM analysis_passes WHERE analysis_id=${id}) AS passes`
  expect(counts.calls).toBe(8);expect(counts.passes).toBe(8)
})
test('an unavailable optional repair retains the completed interpretation and its blocking checks instead of losing the result',async()=>{
  empty=false;repair=true;repairTimeout=true
  try {
    const state=await input(),response=await request(app,user,`/projects/${state.project.id}/analysis`,'POST',state.input)
    const result=await terminal((await response.json()).analysisId)
    expect(result.status).toBe('ready');expect(result.result.quality.status).toBe('blocked')
    expect(result.result.proposal.candidates.filter((item:Candidate)=>item.kind==='wall')).toHaveLength(4)
    expect(result.result.quality.issues.some((item:{code:string})=>item.code==='REPAIR_UNAVAILABLE')).toBe(true)
    const [project]=await h.db`SELECT revision FROM projects WHERE id=${state.project.id}`;expect(Number(project.revision)).toBe(0)
  }finally{repair=false;repairTimeout=false}
})
