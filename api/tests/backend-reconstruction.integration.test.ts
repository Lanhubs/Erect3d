import {afterAll,beforeAll,expect,test} from 'bun:test'
import sharp from 'sharp'
import {account,createProject,fixture,harness,MemoryStore,request,type Account} from './helpers'
import {bytesHash} from '../src/modules/assets/validation'
import {analyze} from '../src/workers/analyze'
import {complete,type Job} from '../src/jobs/queue'
import {loadDocument} from '../src/modules/projects/documents'
import type {Candidate,Intelligence} from '../src/contracts/analysis'
import type {IntelligenceInput} from '../src/modules/ai/provider'
import {defaultRoof} from '../../client/src/domain/types'
const store=new MemoryStore(),h=harness({store,ai:true});let owner:Account
beforeAll(async()=>{owner=await account(h.app)})
afterAll(async()=>{h.limits.close();await h.db.close()})
const base={confidence:.95,evidence:'Source wall band',uncertainties:[],needsReview:true as const}
const ring=[{x:.1,y:.1},{x:.9,y:.1},{x:.9,y:.9},{x:.1,y:.9}]
const walls:Candidate[]=ring.map((p,i)=>({...base,id:`wall-${i}`,kind:'wall',points:[p,ring[(i+1)%4]],thickness:.015,heightMetres:3,wallKind:'exterior'}))
const understanding={buildingType:'house' as const,footprint:ring,conventions:[],circulation:[],uncertainties:[],
  scale:{a:ring[0],b:ring[1],knownMetres:10,origin:'annotated' as const,evidence:'Overall dimension 10000 mm'}}
async function setup(pdf=false) {
  const project=fixture(),level=project.buildings[0].levels[0],sourceId=crypto.randomUUID(),assetId=crypto.randomUUID()
  const bytes=await sharp({create:{width:1000,height:800,channels:3,background:'white'}}).png().toBuffer()
  const calibration={a:{x:0,z:0},b:{x:1000,z:0},knownMetres:12,metresPerPixel:.012,method:'auto' as const}
  project.buildings[0].roof={...defaultRoof,shape:'gable'}
  project.buildings[0].levels.push({...structuredClone(level),id:crypto.randomUUID(),name:'Upper floor',elevation:3,walls:[],doors:[],windows:[],rooms:[]})
  level.sourceId=sourceId;level.calibration=calibration
  project.sources=[{id:sourceId,name:'Generated plan',mime:pdf?'application/pdf':'image/png',originalBytes:bytes.length,width:1000,height:800,...(pdf?{page:2,pages:2}:{})}]
  await createProject(h.app,owner,project)
  const key=`private/${project.id}/${assetId}`;await store.write(key,bytes)
  await h.db`INSERT INTO assets(id,project_id,actor_id,object_key,name,mime,size,kind,state,sha256,metadata)
    VALUES (${assetId},${project.id},${owner.id},${key},'Generated plan','image/png',${bytes.length},${pdf?'raster':'source'},'ready',${bytesHash(bytes)},${{width:1000,height:800,orientation:1}}::jsonb)`
  const pdfBytes=new TextEncoder().encode('%PDF-1.4\nSynthetic PDF fixture; fake provider only\n%%EOF'),originalId=crypto.randomUUID()
  if (pdf) {
    const originalKey=`private/${project.id}/${originalId}`;await store.write(originalKey,pdfBytes)
    await h.db`INSERT INTO assets(id,project_id,actor_id,object_key,name,mime,size,kind,state,sha256,metadata)
      VALUES (${originalId},${project.id},${owner.id},${originalKey},'Generated PDF','application/pdf',${pdfBytes.length},'source','ready',${bytesHash(pdfBytes)},${{signatureValidated:true}}::jsonb)`
    expect((await request(h.app,owner,`/projects/${project.id}/sources/${sourceId}`,'PUT',{originalAssetId:originalId,rasterAssetId:assetId,page:2})).status).toBe(204)
  }
  const input={sourceAssetId:assetId,sourceId,levelId:level.id,calibration,...(pdf?{page:2}:{}),
    deterministicCandidates:[{...walls[0],id:'browser-noise',points:[{x:0,y:0},{x:1,y:0}]}],options:{engine:'backend',purpose:'rebuild',strategy:'detailed',mode:'rooms',cloudConsent:true}}
  const response=await request(h.app,owner,`/projects/${project.id}/analysis`,'POST',input)
  expect(response.status).toBe(202);const {analysisId}=await response.json()
  const [job]=await h.db`UPDATE jobs SET status='running',attempts=1,lease_owner='backend-test',lease_expires_at=now()+interval '60 seconds' WHERE id=${analysisId} RETURNING *`
  const passes:string[]=[]
  const provider={async interpret(input:IntelligenceInput) {
    passes.push(input.pass);expect(input.candidates.some(item=>item.id==='browser-noise')).toBe(false)
    expect(input.currentModel).toEqual([])
    if (pdf) {expect(input.document?.bytes).toEqual(pdfBytes);expect(input.document?.page).toBe(2)}
    let candidates:Candidate[]=[]
    if (input.pass==='structure') candidates=walls
    if (input.pass==='openings') candidates=[{...base,id:'door',kind:'door',wallId:'wall-0',points:[{x:.3,y:.1},{x:.4,y:.1}],doorStyle:'panel',hinge:'right',heightMetres:2.1},
      {...base,id:'window',kind:'window',wallId:'wall-1',points:[{x:.9,y:.3},{x:.9,y:.45}],windowType:'casement',sillMetres:.9,heightMetres:1.2}]
    if (input.pass==='rooms-labels') candidates=[{...base,id:'room',kind:'room',points:ring,label:'Living / dining'}]
    if (input.pass==='model-repair') {expect(input.candidates.some(item=>item.kind==='door')).toBe(true);candidates=[{...walls[2],thickness:.02}]}
    return {proposal:{coordinatesVersion:1 as const,coordinateSystem:'normalized-image-top-left' as const,candidates,warnings:[],...(input.pass==='global-understanding'?{understanding}:{})}}
  }}
  return {project,level,input,analysisId,job:job as Job,provider,passes,originalId}
}
test('backend ignores browser lines, repairs AI geometry, compiles a repeatable server preview, and replaces one floor with explicit approval',async()=>{
  const state=await setup(),{project,level,analysisId}=state
  const result=await analyze(h.db,h.config,store,state.provider,state.job,new AbortController().signal);await complete(h.db,state.job,result)
  expect(state.passes).toContain('model-repair');expect(state.passes).toContain('consistency')
  const review=await (await request(h.app,owner,`/analysis/${analysisId}`)).json()
  expect(review.result.quality.status).toBe('ready');expect(review.result.proposal.candidates).toHaveLength(7)
  const input={operationId:crypto.randomUUID(),baseRevision:0,candidateIds:review.result.proposal.candidates.map((item:Candidate)=>item.id)}
  const first=await request(h.app,owner,`/analysis/${analysisId}/preview`,'POST',input);expect(first.status).toBe(200)
  const preview=await first.json(),again=await (await request(h.app,owner,`/analysis/${analysisId}/preview`,'POST',input)).json()
  expect(preview.document).toEqual(again.document);expect((await loadDocument(h.db,project.id)).revision).toBe(0)
  const floor=preview.document.buildings[0].levels[0]
  expect(floor.walls).toHaveLength(4);expect(floor.walls[2].thickness).toBe(.25);expect(floor.calibration.metresPerPixel).toBe(.0125)
  expect(floor.rooms[0].name).toBe('Living / dining');expect(floor.doors[0].hinge).toBe('right');expect(floor.windows[0].sill).toBe(.9)
  expect(preview.document.buildings[0].roof.shape).toBe('gable');expect(preview.document.buildings[0].levels[1]).toEqual(project.buildings[0].levels[1])
  const denied=await request(h.app,owner,`/analysis/${analysisId}/accept`,'POST',input)
  expect(denied.status).toBe(422);expect((await denied.json()).error.code).toBe('REBUILD_APPROVAL_REQUIRED')
  const accepted=await request(h.app,owner,`/analysis/${analysisId}/accept`,'POST',{...input,replaceLevel:true});expect(accepted.status).toBe(200)
  const current=await loadDocument(h.db,project.id)
  expect(current.revision).toBe(1);expect({...current.document,modified:preview.document.modified}).toEqual(preview.document)
  expect((await request(h.app,owner,`/analysis/${analysisId}/accept`,'POST',{...input,replaceLevel:true})).status).toBe(200)
  expect(level.walls).toHaveLength(1)
})
test('backend reads the linked original PDF with selected page context, and refuses a changed document before any provider call',async()=>{
  const valid=await setup(true)
  await analyze(h.db,h.config,store,valid.provider,valid.job,new AbortController().signal)
  expect(valid.passes).toHaveLength(7)
  const changed=await setup(true)
  await h.db`UPDATE assets SET sha256=${'0'.repeat(64)} WHERE id=${changed.originalId}`
  await expect(analyze(h.db,h.config,store,changed.provider,changed.job,new AbortController().signal)).rejects.toMatchObject({code:'SOURCE_DOCUMENT_CHANGED'})
  expect(changed.passes).toHaveLength(0)
},15000)
test('default direct reconstruction makes one provider request and publishes visible progress before a valid model',async()=>{
  const state=await setup(),payload={...state.job.payload as any,options:{...state.input.options,strategy:'direct'}}
  await h.db`UPDATE jobs SET payload=${payload}::jsonb WHERE id=${state.analysisId}`
  await h.db`UPDATE analyses SET options=${payload.options}::jsonb WHERE id=${state.analysisId}`
  const candidates=ring.map((point,index)=>({...base,id:`w${index}`,kind:'wall' as const,points:[point,ring[(index+1)%4]],thickness:.02}))
  let calls=0
  await analyze(h.db,h.config,store,{async interpret(input){calls++;expect(input.pass).toBe('reconstruct-model');return {proposal:{coordinatesVersion:1,coordinateSystem:'normalized-image-top-left',candidates,warnings:[],understanding}}}},
    {...state.job,payload},new AbortController().signal)
  expect(calls).toBe(1)
  const [row]=await h.db`SELECT status,result FROM analyses WHERE id=${state.analysisId}`
  expect(row.status).toBe('ready');expect(row.result.quality.status).not.toBe('blocked')
  const events=await h.db`SELECT payload FROM realtime_events WHERE project_id=${state.project.id} AND type='analysis.progress' ORDER BY id`
  expect(events.map((event:{payload:{progress:{current:string}}})=>event.payload.progress.current)).toEqual(['measure-source','reconstruct-model','model-validation'])
},15000)

test('dense direct reconstruction compiles the four concurrent regional proposals under one analysis job',async()=>{
  const state=await setup(),payload={...state.job.payload as any,options:{...state.input.options,strategy:'direct',complex:true}}
  await h.db`UPDATE jobs SET payload=${payload}::jsonb WHERE id=${state.analysisId}`
  await h.db`UPDATE analyses SET options=${payload.options}::jsonb WHERE id=${state.analysisId}`
  const passes:string[]=[]
  await analyze(h.db,h.config,store,{async interpret(input){
    passes.push(input.pass)
    if(input.pass==='global-understanding')return {proposal:{coordinatesVersion:1,coordinateSystem:'normalized-image-top-left',candidates:[],warnings:[],understanding}}
    expect(input.pass).toMatch(/^reconstruct-region-[1-4]$/);expect(input.crop).toBeDefined();expect(input.details).toBeUndefined()
    expect((await sharp(input.bytes).metadata()).width).toBe(1000)
    const index=Number(input.pass.at(-1))-1,point=[ring[0],ring[1],ring[3],ring[2]][index]
    const end=index%2?{...point,y:.5}:{...point,x:.5}
    return {proposal:{coordinatesVersion:1,coordinateSystem:'normalized-image-top-left',candidates:[{...base,id:'regional-wall',kind:'wall',points:[point,end],thickness:.015}],warnings:[]}}
  }},{...state.job,payload},new AbortController().signal)
  expect(passes).toHaveLength(5)
  const [row]=await h.db`SELECT result FROM analyses WHERE id=${state.analysisId}`
  expect(row.result.quality.status).not.toBe('blocked')
  expect(row.result.proposal.candidates.filter((item:Candidate)=>item.kind==='wall').map((item:Candidate)=>item.id)).toEqual(['region1_regional-wall','region2_regional-wall','region3_regional-wall','region4_regional-wall'])
},15000)
test('retry reuses completed reads only for the identical source, settings and model revision',async()=>{
  const state=await setup(),proposal={coordinatesVersion:1,coordinateSystem:'normalized-image-top-left',candidates:[],warnings:[],understanding}
  await h.db`INSERT INTO analysis_passes(analysis_id,pass,proposal,usage) VALUES (${state.analysisId},'global-understanding',${proposal}::jsonb,${{promptTokens:10}}::jsonb)`
  await h.db`UPDATE jobs SET status='failed',failure_code='AI_TIMEOUT',completed_at=now() WHERE id=${state.analysisId}`
  await h.db`UPDATE analyses SET status='failed' WHERE id=${state.analysisId}`
  const retry=await request(h.app,owner,`/projects/${state.project.id}/analysis`,'POST',state.input)
  expect(retry.status).toBe(202);const {analysisId}=await retry.json()
  const reused=await h.db`SELECT pass,proposal,usage FROM analysis_passes WHERE analysis_id=${analysisId}`
  expect(reused).toHaveLength(1);expect(reused[0].proposal).toEqual(proposal)
  expect(reused[0].usage).toEqual({promptTokens:10,reusedFromAnalysisId:state.analysisId})
  const changed=await request(h.app,owner,`/projects/${state.project.id}/analysis`,'POST',{...state.input,options:{...state.input.options,complex:true}})
  const fresh=await changed.json()
  expect(await h.db`SELECT pass FROM analysis_passes WHERE analysis_id=${fresh.analysisId}`).toHaveLength(0)
},15000)
