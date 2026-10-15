import { afterAll,beforeAll,expect,test } from 'bun:test'
import sharp from 'sharp'
import { account,createProject,fixture,harness,MemoryStore,request,type Account } from './helpers'
import { bytesHash } from '../src/modules/assets/validation'
import { analyze } from '../src/workers/analyze'
import { fail,type Job } from '../src/jobs/queue'
import type { IntelligenceInput } from '../src/modules/ai/provider'
import { classifyFailure,ProviderFailure } from '../src/modules/ai/provider'
import { newId } from '../src/security/tokens'
import { writeDerivedAsset } from '../src/workers/output'
const store=new MemoryStore(),h=harness({ store,ai:true })
let user:Account
beforeAll(async()=>{ user=await account(h.app) })
afterAll(async()=>{ h.limits.close();await h.db.close() })
async function pending() {
  const project=fixture(),level=project.buildings[0].levels[0],sourceId=newId('source'),assetId=newId('asset')
  const bytes=await sharp({ create:{ width:100,height:100,channels:3,background:'white' } }).png().toBuffer()
  const calibration={ a:{ x:0,z:0 },b:{ x:100,z:0 },knownMetres:10,metresPerPixel:.1,method:'auto' as const }
  project.sources=[{ id:sourceId,name:'Plan',mime:'image/png',originalBytes:bytes.length,width:100,height:100 }]
  level.sourceId=sourceId;level.calibration=calibration
  await createProject(h.app,user,project)
  const key=`private/${project.id}/${assetId}`
  await store.write(key,bytes)
  await h.db`INSERT INTO assets(id,project_id,actor_id,object_key,name,mime,size,kind,state,sha256,metadata)
    VALUES (${assetId},${project.id},${user.id},${key},'Plan','image/png',${bytes.length},'source','ready',${bytesHash(bytes)},${{ width:100,height:100,orientation:1 }}::jsonb)`
  const response=await request(h.app,user,`/projects/${project.id}/analysis`,'POST',{ sourceAssetId:assetId,sourceId,
    levelId:level.id,calibration,options:{ mode:'structure',cloudConsent:true } })
  expect(response.status).toBe(202)
  const { analysisId }=await response.json()
  const [job]=await h.db`UPDATE jobs SET status='running',attempts=1,lease_owner='lifecycle-worker',lease_expires_at=now()+interval '60 seconds'
    WHERE id=${analysisId} RETURNING *`
  return { job:job as Job,project }
}
const proposal={ coordinatesVersion:1 as const,coordinateSystem:'normalized-image-top-left' as const,candidates:[],warnings:[] }
test('cancelling an in-flight provider prevents late result publication and acceptance',async()=>{
  const { job,project }=await pending()
  let release!:()=>void,started!:()=>void
  const began=new Promise<void>(resolve=>{ started=resolve }),gate=new Promise<void>(resolve=>{ release=resolve })
  const provider={ async interpret(_input:IntelligenceInput,_signal:AbortSignal) { started();await gate;return { proposal } } }
  const running=analyze(h.db,h.config,store,provider,job,new AbortController().signal)
  await began
  expect((await request(h.app,user,`/analysis/${job.id}/cancel`,'POST')).status).toBe(204)
  release()
  await expect(running).rejects.toThrow('Background work was cancelled')
  const [row]=await h.db`SELECT status,result FROM analyses WHERE id=${job.id}`
  expect(row.status).toBe('cancelled');expect(row.result).toBeNull()
  expect((await request(h.app,user,`/analysis/${job.id}/accept`,'POST',{ operationId:crypto.randomUUID(),baseRevision:0,candidateIds:['fake'] })).status).toBe(409)
  const [current]=await h.db`SELECT revision FROM projects WHERE id=${project.id}`
  expect(Number(current.revision)).toBe(0)
})
test('completed passes survive a transient failure and retries do not spend quota repeating them',async()=>{
  const { job }=await pending(),calls:string[]=[]
  let fail=true
  const provider={ async interpret(input:IntelligenceInput,_signal:AbortSignal) {
    calls.push(input.pass)
    if (input.pass==='openings' && fail) { fail=false;throw new ProviderFailure('AI_QUOTA',true) }
    return { proposal,usage:{ totalTokens:10 } }
  } }
  await expect(analyze(h.db,h.config,store,provider,job,new AbortController().signal)).rejects.toThrow('AI_QUOTA')
  await analyze(h.db,h.config,store,provider,job,new AbortController().signal)
  expect(calls).toEqual(['global-understanding','structure','openings','openings'])
  const [row]=await h.db`SELECT status FROM analyses WHERE id=${job.id}`
  expect(row.status).toBe('ready')
  expect(classifyFailure({ status:429 }).retryable).toBe(true)
  expect(classifyFailure({ status:400 }).retryable).toBe(false)
  await h.db`UPDATE jobs SET status='completed',completed_at=now() WHERE id=${job.id}`
})
test('invalid structured provider output is permanently rejected before document changes',async()=>{
  const { job }=await pending()
  const provider={ async interpret() { return { proposal:{ ...proposal,candidates:[{ invalid:'candidate' }] } as any } } }
  await expect(analyze(h.db,h.config,store,provider,job,new AbortController().signal)).rejects.toThrow('Input did not match')
  const [row]=await h.db`SELECT result FROM analyses WHERE id=${job.id}`
  expect(row.result).toBeNull()
  await h.db`UPDATE jobs SET status='failed',failure_code='AI_SCHEMA_MISMATCH' WHERE id=${job.id}`
  await h.db`UPDATE analyses SET status='failed' WHERE id=${job.id}`
})
test('a stale worker cannot fail an analysis reclaimed by another worker',async()=>{
  const { job }=await pending()
  await h.db`UPDATE jobs SET lease_owner='replacement-worker',attempts=2 WHERE id=${job.id}`
  await fail(h.db,job,'AI_SCHEMA_MISMATCH',false)
  const [row]=await h.db`SELECT a.status,j.lease_owner FROM analyses a JOIN jobs j ON j.id=a.id WHERE a.id=${job.id}`
  expect(row.status).toBe('pending');expect(row.lease_owner).toBe('replacement-worker')
  await h.db`UPDATE jobs SET status='cancelled' WHERE id=${job.id}`
  await h.db`UPDATE analyses SET status='cancelled' WHERE id=${job.id}`
})
test('cancelled derived output is cleaned up and cannot overwrite a committed asset',async()=>{
  const { job }=await pending(),assetId=newId('asset')
  const output={ bytes:new Uint8Array([1,2,3]),name:'Export',mime:'application/json',kind:'export' as const,metadata:{} }
  await writeDerivedAsset(h.db,store,job,assetId,output)
  const [asset]=await h.db`SELECT object_key FROM assets WHERE id=${assetId}`
  await writeDerivedAsset(h.db,store,job,assetId,{ ...output,bytes:new Uint8Array([9,9]) })
  expect([...(await store.read(asset.object_key,100))]).toEqual([1,2,3])
  await h.db`UPDATE jobs SET status='cancelled' WHERE id=${job.id}`
  const count=store.objects.size
  await expect(writeDerivedAsset(h.db,store,job,newId('asset'),output)).rejects.toThrow('Background work was cancelled')
  expect(store.objects.size).toBe(count)
  await h.db`UPDATE analyses SET status='cancelled' WHERE id=${job.id}`
})
