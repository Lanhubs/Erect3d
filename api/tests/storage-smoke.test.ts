import { expect,test } from 'bun:test'
import { readConfig } from '../src/config/env'
import { MemoryStore } from './helpers'
import { checkPrivateR2 } from '../scripts/storage-smoke'
const config=readConfig({ DATABASE_URL:'postgres://test@localhost/erect_test',R2_ENDPOINT:'https://test.r2.cloudflarestorage.com',
  R2_BUCKET:'test-bucket',R2_ACCESS_KEY_ID:'test-key',R2_SECRET_ACCESS_KEY:'test-secret' }),origin='https://erect3d.example.test'
function scenario(cors=origin,anonymousStatus=403,lostResponse=false) {
  const store=new MemoryStore()
  const request=(async (url:RequestInfo|URL,input?:RequestInit)=>{
    const path=new URL(String(url)).pathname,key=path.replace(/^\/(put|get)\//,'')
    if (input?.method==='PUT') {
      await store.write(key,new Uint8Array(input.body as Uint8Array))
      if (lostResponse) throw new Error('response lost')
      return new Response(null,{ status:200 })
    }
    if (!input?.headers) return new Response(null,{ status:anonymousStatus })
    return new Response(new Uint8Array(store.objects.get(key)!),{ status:200,headers:{ 'Access-Control-Allow-Origin':cors } })
  }) as typeof fetch
  return { store,request }
}
test('R2 smoke verifies optimized image transfers, exact origin CORS and deletion of its own test object',async()=>{
  const dependencies=scenario(),result=await checkPrivateR2(config,origin,dependencies)
  expect(result.storedBytes).toBeLessThan(result.inputBytes);expect(result.corsChecked).toBe(true)
  expect(dependencies.store.objects.size).toBe(0)
})
test('a public response, server failure or wrong CORS cannot pass privacy checks and cleanup still occurs',async()=>{
  for (const [cors,status] of [[origin,200],[origin,500],['*',403]] as const) {
    const dependencies=scenario(cors,status)
    await expect(checkPrivateR2(config,origin,dependencies)).rejects.toThrow(status===403?'CORS':'not denied')
    expect(dependencies.store.objects.size).toBe(0)
  }
})
test('an upload with a lost response still cleans up its possible test object',async()=>{
  const dependencies=scenario(origin,403,true)
  await expect(checkPrivateR2(config,origin,dependencies)).rejects.toThrow('response lost')
  expect(dependencies.store.objects.size).toBe(0)
})
