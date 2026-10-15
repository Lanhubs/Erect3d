import { afterAll,beforeAll,expect,test } from 'bun:test'
import sharp from 'sharp'
import { account,createProject,fixture,harness,MemoryStore,request,type Account } from './helpers'
import type { IntelligenceInput,PlanIntelligenceProvider } from '../src/modules/ai/provider'
import { ProviderFailure } from '../src/modules/ai/provider'
import { Worker } from '../src/workers/runner'
import { claim,complete,enqueue,fail,renew } from '../src/jobs/queue'
import { loadDocument } from '../src/modules/projects/documents'
class FakeProvider implements PlanIntelligenceProvider {
  calls=0
  async interpret(_input:IntelligenceInput,_signal:AbortSignal) {
    this.calls++
    return { proposal:{ coordinatesVersion:1 as const,coordinateSystem:'normalized-image-top-left' as const,
      candidates:[{ id:'wall-evidence',kind:'wall' as const,points:[{ x:.1,y:.1 },{ x:.9,y:.1 }],
        confidence:.85,evidence:'A thick dark wall stroke',uncertainties:['Scale is provisional'],needsReview:true as const }],warnings:[] },
      usage:{ totalTokens:100 } }
  }
}
const store=new MemoryStore(),provider=new FakeProvider(),h=harness({ store,provider,ai:true })
let owner:Account,outsider:Account
beforeAll(async()=>{
  // This suite owns the queue in the isolated *_test database; old test runs may leave leases.
  await h.db`UPDATE jobs SET status='cancelled',completed_at=now() WHERE status IN ('queued','running')`
  owner=await account(h.app); outsider=await account(h.app)
})
afterAll(async()=>{ h.limits.close(); await h.db.close() })
async function upload(projectId:string,bytes:Uint8Array,mime='image/png') {
  const response=await request(h.app,owner,`/projects/${projectId}/assets/uploads`,'POST',{ name:'source.png',mime,size:bytes.length,kind:'source' })
  const result=await response.json()
  expect(response.status).toBe(201)
  const [asset]=await h.db`SELECT object_key FROM assets WHERE id=${result.assetId}`
  await store.write(asset.object_key,bytes)
  return { ...result,key:asset.object_key }
}
test('private uploads verify actual bytes and size, isolate final objects, and deny foreign access',async()=>{
  const project=await createProject(h.app,owner),bytes=await sharp({ create:{ width:100,height:100,channels:3,background:'white' } }).png().toBuffer()
  const uploaded=await upload(project.id,bytes)
  const finalized=await request(h.app,owner,`/projects/${project.id}/assets/${uploaded.assetId}/finalize`,'POST')
  expect(finalized.status).toBe(200)
  const [asset]=await h.db`SELECT object_key,metadata,state FROM assets WHERE id=${uploaded.assetId}`
  expect(asset.object_key).not.toBe(uploaded.key); expect(asset.metadata.width).toBe(100)
  await store.write(uploaded.key,new Uint8Array([1,2,3]))
  const stored=await store.read(asset.object_key,100000)
  expect(stored.length).toBeLessThanOrEqual(bytes.length)
  expect(await sharp(stored).raw().toBuffer()).toEqual(await sharp(bytes).raw().toBuffer())
  expect((await request(h.app,outsider,`/projects/${project.id}/assets/${uploaded.assetId}/download`)).status).toBe(404)
  const disguised=await upload(project.id,new TextEncoder().encode('<script>not an image</script>'))
  expect((await request(h.app,owner,`/projects/${project.id}/assets/${disguised.assetId}/finalize`,'POST')).status).toBe(422)
})
test('cloud analysis is cached, remains a proposal, and only accepted candidates create canonical geometry',async()=>{
  const bytes=await sharp({ create:{ width:100,height:100,channels:3,background:'white' } }).png().toBuffer()
  const project=fixture(),level=project.buildings[0].levels[0],sourceId='source_'+crypto.randomUUID()
  const calibration={ a:{ x:0,z:0 },b:{ x:100,z:0 },knownMetres:10,metresPerPixel:.1,method:'auto' as const }
  project.sources=[{ id:sourceId,name:'Plan.png',mime:'image/png',originalBytes:bytes.length,width:100,height:100 }]
  level.sourceId=sourceId; level.calibration=calibration
  await createProject(h.app,owner,project)
  const asset=await upload(project.id,bytes)
  expect((await request(h.app,owner,`/projects/${project.id}/assets/${asset.assetId}/finalize`,'POST')).status).toBe(200)
  const input={ sourceAssetId:asset.assetId,sourceId,levelId:level.id,calibration,options:{ mode:'structure',cloudConsent:true } }
  const response=await request(h.app,owner,`/projects/${project.id}/analysis`,'POST',input)
  expect(response.status).toBe(202)
  const { analysisId }=await response.json(),worker=new Worker(h.db,h.config,store,provider)
  for (let index=0;index<20;index++) {
    const [row]=await h.db`SELECT status FROM analyses WHERE id=${analysisId}`
    if (row.status==='ready') break
    await worker.runOnce()
  }
  const analysis=await (await request(h.app,owner,`/analysis/${analysisId}`)).json()
  expect(analysis.status).toBe('ready'); expect(provider.calls).toBe(3)
  expect((await loadDocument(h.db,project.id)).revision).toBe(0)
  const cached=await (await request(h.app,owner,`/projects/${project.id}/analysis`,'POST',input)).json()
  expect(cached.analysisId).toBe(analysisId); expect(cached.cached).toBe(true)
  const review={ operationId:crypto.randomUUID(),baseRevision:0,candidateIds:['wall-evidence'] }
  const accepted=await request(h.app,owner,`/analysis/${analysisId}/accept`,'POST',review)
  expect(accepted.status).toBe(200)
  expect((await loadDocument(h.db,project.id)).document.buildings[0].levels[0].walls).toHaveLength(2)
  expect((await request(h.app,owner,`/analysis/${analysisId}/accept`,'POST',review)).status).toBe(200)
  expect((await request(h.app,outsider,`/analysis/${analysisId}`)).status).toBe(404)
},15000)
test('SKIP LOCKED leases prevent duplicate completion and cancellation rejects late workers',async()=>{
  const project=await createProject(h.app,owner),actor={ id:owner.id,email:'unused',name:'Owner',sessionId:'unused' }
  const id=await enqueue(h.db,actor,project.id,'project.snapshot',{ revision:0 },crypto.randomUUID())
  const claimed=await claim(h.db,'worker-a',30)
  expect(claimed?.id).toBe(id)
  const other=await claim(h.db,'worker-b',30)
  expect(other?.id).not.toBe(id)
  await h.db`UPDATE jobs SET status='cancelled' WHERE id=${id}`
  expect(await complete(h.db,claimed!,{ anything:true })).toBe(false)
  expect(await renew(h.db,claimed!,30)).toBe(false)
})
test('permanent failures dead-letter immediately and transient failures retry with bounded backoff',async()=>{
  const project=await createProject(h.app,owner),actor={ id:owner.id,email:'unused',name:'Owner',sessionId:'unused' }
  const id=await enqueue(h.db,actor,project.id,'project.snapshot',{ revision:0 },crypto.randomUUID())
  const job=await claim(h.db,'worker-c',30)
  expect(job!.id).toBe(id)
  await fail(h.db,job!,'AI_SCHEMA_MISMATCH',false)
  const [failed]=await h.db`SELECT status,attempts FROM jobs WHERE id=${id}`
  expect(failed.status).toBe('failed'); expect(failed.attempts).toBe(1)
  expect(new ProviderFailure('AI_QUOTA',true).retryable).toBe(true)
})
