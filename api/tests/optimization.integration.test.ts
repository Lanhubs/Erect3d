import { afterAll,expect,test } from 'bun:test'
import sharp from 'sharp'
import { account,createProject,harness,MemoryStore,origin,request } from './helpers'
import { optimizeAsset } from '../src/modules/assets/optimize'
import { readConfig } from '../src/config/env'
import { PrivateR2 } from '../src/storage/objects'
import { normalizeImage } from '../src/workers/images'
import { complete,type Job } from '../src/jobs/queue'
import { unpackSource } from '../src/storage/archive'
const store=new MemoryStore(),h=harness({ store }),config={ PDF_OPTIMIZER_PATH:undefined,ASSET_OPTIMIZE_TIMEOUT_MS:30000 }
afterAll(async()=>{ h.limits.close();await h.db.close() })
const drawing=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="white"/><path d="M60 550V60H750V550H460 M400 550H60" fill="none" stroke="black" stroke-width="10"/><path d="M400 550V490 M400 490Q460 490 460 550" fill="none" stroke="black" stroke-width="1"/></svg>')
test('floor-plan PNG optimization reduces stored bytes while preserving exact thin-line pixels and dimensions',async()=>{
  const bytes=await sharp(drawing).png({ compressionLevel:0 }).toBuffer(),result=await optimizeAsset(bytes,'image/png',config)
  expect(result.storedBytes).toBeLessThan(result.inputBytes/4);expect(result.method).toBe('lossless-zip')
  const restored=unpackSource('private/source.zip',result.bytes,bytes.length)
  expect(restored).toEqual(new Uint8Array(bytes));expect((await sharp(restored).metadata()).width).toBe(800)
})
test('JPEG optimization keeps its compressed image data, exact decoded pixels and Exif orientation',async()=>{
  const original=await sharp(drawing).withMetadata({ orientation:6 }).jpeg({ quality:90 }).toBuffer()
  const comment=Buffer.from('removable comment '.repeat(100)),marker=Buffer.from([255,254,(comment.length+2)>>8,(comment.length+2)&255])
  const bytes=Buffer.concat([original.subarray(0,2),marker,comment,original.subarray(2)]),result=await optimizeAsset(bytes,'image/jpeg',config)
  expect(result.storedBytes).toBeLessThan(bytes.length);expect(result.method).toBe('lossless-zip')
  const restored=unpackSource('private/source.zip',result.bytes,bytes.length)
  expect(restored).toEqual(new Uint8Array(bytes));expect((await sharp(restored).metadata()).orientation).toBe(6)
})

test('specialized PNG bit depth and color profiles remain intact rather than being quantized',async()=>{
  const variants=[await sharp(drawing).toColourspace('rgb16').png({ compressionLevel:0 }).toBuffer(),
    await sharp(drawing).withIccProfile('srgb').png({ compressionLevel:0 }).toBuffer()]
  for (const bytes of variants) {
    const optimized=await optimizeAsset(bytes,'image/png',config)
    expect(unpackSource(optimized.method==='lossless-zip'?'source.zip':'source',optimized.bytes,bytes.length)).toEqual(new Uint8Array(bytes))
  }
})
test('already compressed files are never enlarged and missing PDF optimization is reported without damaging the original',async()=>{
  const bytes=new TextEncoder().encode('%PDF-1.7\n% test original'),result=await optimizeAsset(bytes,'application/pdf',config)
  expect(result.bytes).toEqual(bytes);expect(result.savedBytes).toBe(0);expect(result.method).toBe('original-bytes')
})
test('optimized client ingestion writes only compact bytes, reports savings, and retries a binary upload idempotently',async()=>{
  const user=await account(h.app),project=await createProject(h.app,user),bytes=await sharp(drawing).png({ compressionLevel:0 }).toBuffer()
  const path=`/api/v1/projects/${project.id}/assets/optimized-upload?name=Plan.png&kind=source&mime=image%2Fpng`,key=crypto.randomUUID()
  const upload=()=>h.app.request(path,{ method:'POST',headers:{ Origin:origin,Cookie:user.cookie,'X-CSRF-Token':user.csrf,'Content-Type':'image/png','Idempotency-Key':key },body:new Uint8Array(bytes) })
  const first=await upload();expect(first.status).toBe(201);const data=await first.json()
  expect(data.optimization.savedBytes).toBeGreaterThan(0);expect(data.metadata.width).toBe(800)
  expect((await (await upload()).json()).assetId).toBe(data.assetId);expect(store.objects.size).toBe(1)
  const [asset]=await h.db`SELECT size,object_key FROM assets WHERE id=${data.assetId}`
  expect(Number(asset.size)).toBe(data.optimization.storedBytes);expect(await store.read(asset.object_key,bytes.length)).toEqual(new Uint8Array(bytes))
  const denied=await h.app.request(path,{ method:'POST',headers:{ Origin:origin,'Content-Type':'image/png','Idempotency-Key':crypto.randomUUID() },body:new Uint8Array(bytes) })
  expect(denied.status).toBe(401)
  const forged=await h.app.request(path,{ method:'POST',headers:{ Origin:origin,Cookie:user.cookie,'X-CSRF-Token':user.csrf,'Content-Type':'image/png','Idempotency-Key':crypto.randomUUID() },body:'not a plan' })
  expect(forged.status).toBe(422)
  const snapshot=await request(h.app,user,`/projects/${project.id}`);expect(snapshot.status).toBe(200)
})
test('R2 configuration uses auto region and signs private objects against the account API endpoint',()=>{
  const config=readConfig({ DATABASE_URL:'postgres://test@localhost/erect_test',STORAGE_BACKEND:'r2',R2_ENDPOINT:`https://${'a'.repeat(32)}.r2.cloudflarestorage.com`,
    R2_BUCKET:'private-plans',R2_ACCESS_KEY_ID:'test-access-id',R2_SECRET_ACCESS_KEY:'test-secret' })
  expect(config.R2_REGION).toBe('auto')
  const url=new URL(new PrivateR2(config).uploadUrl('private/project/plan.png','image/png'))
  expect(url.hostname).toBe(`${'a'.repeat(32)}.r2.cloudflarestorage.com`);expect(url.pathname).toContain('private-plans/private/project/plan.png')
  expect(url.searchParams.get('X-Amz-Credential')).toContain('/auto/s3/aws4_request')
  expect(()=>readConfig({ ...config,R2_SECRET_ACCESS_KEY:undefined })).toThrow('R2_BUCKET')
  expect(()=>readConfig({ ...config,R2_ENDPOINT:'https://public.example.test/plans' })).toThrow('R2_ENDPOINT')
})

test('image normalization reuses upright plans, compresses derived rasters and clears recovered job failures',async()=>{
  const user=await account(h.app),project=await createProject(h.app,user)
  for (const orientation of [1,6]) {
    const bytes=await sharp(drawing).withMetadata({ orientation }).jpeg({ quality:95 }).toBuffer()
    const uploaded=await h.app.request(`/api/v1/projects/${project.id}/assets/optimized-upload?name=Plan.jpg&kind=source&mime=image%2Fjpeg`,{
      method:'POST',headers:{ Origin:origin,Cookie:user.cookie,'X-CSRF-Token':user.csrf,'Content-Type':'image/jpeg','Idempotency-Key':crypto.randomUUID() },body:new Uint8Array(bytes) })
    expect(uploaded.status).toBe(201);const { assetId }=await uploaded.json()
    const [job]=await h.db`UPDATE jobs SET status='running',lease_owner='image-test',failure_code='AI_NETWORK',lease_expires_at=now()+interval '60 seconds'
      WHERE project_id=${project.id} AND kind='asset.normalize' AND payload->>'assetId'=${assetId} RETURNING *`
    const before=store.objects.size,result=await normalizeImage(h.db,store,job as Job)
    expect(store.objects.size-before).toBe(orientation===1?1:2)
    if (orientation===1) expect(result.raster).toBe(assetId)
    else {
      const [asset]=await h.db`SELECT object_key FROM assets WHERE id=${result.raster}`
      const raster=await store.read(asset.object_key,10_000_000),metadata=await sharp(raster).metadata()
      expect([metadata.width,metadata.height]).toEqual([600,800])
      expect(await sharp(raster).raw().toBuffer()).toEqual(await sharp(bytes).rotate().raw().toBuffer())
      expect(raster.length).toBeLessThan((await sharp(bytes).rotate().png({ compressionLevel:0 }).toBuffer()).length/4)
    }
    const size=store.objects.size;await normalizeImage(h.db,store,job as Job);expect(store.objects.size).toBe(size)
    expect(await complete(h.db,job as Job,result)).toBe(true)
    const [finished]=await h.db`SELECT status,failure_code FROM jobs WHERE id=${job.id}`
    expect(finished.status).toBe('completed');expect(finished.failure_code).toBeNull()
  }
})
