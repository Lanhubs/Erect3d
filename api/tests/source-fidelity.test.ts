import {expect,test} from 'bun:test'
import sharp from 'sharp'
import {prepareAiImage} from '../src/workers/ai-image'
import {sourceDetails} from '../src/workers/source-document'
import {zipSource,unpackSource} from '../src/storage/archive'
import {ArchiveTickets} from '../src/storage/archive-ticket'
import {classifiedMeasurements,measureSource} from '../src/workers/source-measurements'
import type {Candidate,Intelligence} from '../src/contracts/analysis'
test('large transparent PNGs and JPEGs reach analysis with identical original bytes and resolution',async()=>{
 for(const bytes of [await sharp({create:{width:4000,height:800,channels:4,background:'#00000000'}}).png().toBuffer(),
  await sharp({create:{width:3500,height:400,channels:3,background:'white'}}).withMetadata().jpeg().toBuffer()]) {
  const prepared=await prepareAiImage(bytes)
  expect(prepared.bytes).toEqual(new Uint8Array(bytes));expect((await sharp(prepared.bytes).metadata()).width).toBeGreaterThan(3200)
 }
})
test('detail crops keep native pixels and complex low resolution sheets receive all four regions',async()=>{
 const bytes=await sharp({create:{width:708,height:551,channels:4,background:'#eeccee55'}}).png().toBuffer()
 const details=await sourceDetails(bytes,708,551,true);expect(details).toHaveLength(4)
 for(const detail of details) {
  const metadata=await sharp(detail.bytes).metadata();expect(metadata.width).toBe(390);expect(metadata.height).toBe(304)
  const original=await sharp(bytes).extract({left:Math.floor(detail.region.x*708),top:Math.floor(detail.region.y*551),width:390,height:304}).raw().toBuffer()
  expect(await sharp(detail.bytes).raw().toBuffer()).toEqual(original)
 }
})
test('detail crops retain 16-bit channels rather than quantizing them to 8-bit',async()=>{
 const bytes=await sharp({create:{width:400,height:300,channels:3,background:'#df39ad'}}).toColourspace('rgb16').png().toBuffer()
 const crop=await prepareAiImage(bytes,{x:.25,y:.25,width:.5,height:.5})
 expect((await sharp(crop.bytes).metadata()).depth).toBe('ushort')
 const original=await sharp(bytes).extract({left:100,top:75,width:200,height:150}).pipelineColourspace('rgb16').toColourspace('rgb16').raw({depth:'ushort'}).toBuffer()
 expect(await sharp(crop.bytes).pipelineColourspace('rgb16').toColourspace('rgb16').raw({depth:'ushort'}).toBuffer()).toEqual(original)
})
test('ZIP round trips original metadata and bytes, rejects tampering and oversized decoded sources',()=>{
 const bytes=new TextEncoder().encode('unchanged source metadata '.repeat(1000)),zipped=zipSource(bytes)
 expect(zipped.length).toBeLessThan(bytes.length);expect(unpackSource('private/source.zip',zipped,bytes.length)).toEqual(bytes)
 expect(()=>unpackSource('private/source.zip',zipped,100)).toThrow('Unpacked source exceeded')
 const corrupt=new Uint8Array(zipped);corrupt[14]^=1;expect(()=>unpackSource('private/source.zip',corrupt,bytes.length)).toThrow('invalid')
 expect(unpackSource('private/legacy',bytes,bytes.length)).toEqual(bytes)
})
test('archive download tickets expire and cannot be forged or redirect to staging or traversal paths',()=>{
 const tickets=new ArchiveTickets('private-test-secret'),url=tickets.download('private/project/source.zip'),token=url.split('/').at(-1)!
 expect(tickets.verify(token)).toBe('private/project/source.zip');expect(()=>tickets.verify(token+'!')).toThrow('invalid')
 expect(()=>tickets.verify(tickets.download('staging/a.zip').split('/').at(-1)!)).toThrow('invalid')
 expect(()=>tickets.verify(tickets.download('private/../a.zip').split('/').at(-1)!)).toThrow('invalid')
 const now=Date.now;Date.now=()=>now()+120001
 try{expect(()=>tickets.verify(token)).toThrow('expired')}finally{Date.now=now}
})
test('native OpenCV measurements are deterministic and unclassified court evidence is not automatically erected',async()=>{
 const bytes=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="500" height="400"><rect x="60" y="60" width="350" height="270" fill="none" stroke="black" stroke-width="7"/></svg>')).png().toBuffer()
 const a=await measureSource(bytes),b=await measureSource(bytes);expect(a).toEqual(b);expect(a.report.width).toBe(500);expect(a.report.walls).toBeGreaterThan(0)
 const wall=a.candidates.find(item=>item.kind==='wall')!,court:Candidate={...wall,id:'court'}
 const proposal:Intelligence={coordinatesVersion:1,coordinateSystem:'normalized-image-top-left',candidates:[],warnings:[],dispositions:[{candidateId:wall.id,decision:'confirm',reason:'Visible actual wall band'}]}
 const classified=classifiedMeasurements([wall,court],[proposal]);expect(classified[0].kind).toBe('wall');expect(classified[1].kind).toBe('unknown')
})
test('native fine measurements retain single-pixel partitions for classification rather than erasing or auto-erecting them',async()=>{
 const bytes=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="500" height="400"><rect width="500" height="400" fill="white"/><path d="M120 90V300 M180 90V300 M240 90V300" stroke="black" stroke-width="1"/></svg>')).png().toBuffer()
 const measured=await measureSource(bytes),edges=measured.candidates.filter(item=>item.id.startsWith('cv_edge_'))
 expect(edges.length).toBeGreaterThanOrEqual(3)
 expect(classifiedMeasurements(edges,[]).every(item=>item.kind==='unknown')).toBe(true)
 const selected=edges[0],proposal:Intelligence={coordinatesVersion:1,coordinateSystem:'normalized-image-top-left',candidates:[],warnings:[],dispositions:[{candidateId:selected.id,decision:'confirm',reason:'Actual room partition'}]}
 expect(classifiedMeasurements([selected],[proposal])[0].kind).toBe('wall')
 expect(measured.report.width).toBe(500)
})
