import {expect,test} from 'bun:test'
import type {Candidate,Intelligence} from '../src/contracts/analysis'
import type {IntelligenceInput} from '../src/modules/ai/provider'
import {readRegions,regionOwner,regionalProposal} from '../src/workers/direct-regions'
const candidate=(id:string,x:number,y:number):Candidate=>({id,kind:'wall',points:[{x:x-.01,y},{x:x+.01,y}],confidence:.8,evidence:'Wall',uncertainties:[],needsReview:true})
const empty: Intelligence={coordinatesVersion:1,coordinateSystem:'normalized-image-top-left',candidates:[],warnings:[]}
const measured=[candidate('cv_wall_0',.2,.2),candidate('cv_wall_1',.8,.2),candidate('cv_wall_2',.2,.8),candidate('cv_wall_3',.8,.8)]
const bytes=new Uint8Array([1,2,3]),details=[0,1,2,3].map(index=>({bytes,mime:'image/png',region:{x:index%2*.45,y:Math.floor(index/2)*.45,width:.55,height:.55}}))
const source:IntelligenceInput={bytes,mime:'image/png',width:708,height:551,candidates:measured,pass:'global-understanding',model:'fake',details}
test('dense direct processing starts every region before any finishes and retains source coordinates exactly once',async()=>{
  let active=0,maximum=0;const seen:string[]=[],completed:string[][]=[]
  let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve)
  const result=await readRegions(source,new AbortController().signal,async(input)=>{
    expect(input.bytes).toBe(bytes)
    if(input.pass==='global-understanding')return {...empty,understanding:{buildingType:'arena',footprint:[],conventions:[],circulation:[],uncertainties:[]}}
    maximum=Math.max(maximum,++active);seen.push(...input.candidates.map(item=>item.id))
    expect(input.crop?.bytes).toBe(bytes);expect(input.understanding?.buildingType).toBe('arena')
    if(active===4)release();await gate;active--
    return {...empty,candidates:input.candidates}
  },async(_pass,done)=>{completed.push(done)})
  expect(maximum).toBe(4);expect(seen.sort()).toEqual(measured.map(item=>item.id));expect(result.flatMap(item=>item.candidates)).toEqual(measured)
  expect(completed.at(-1)).toHaveLength(5)
})
test('regional identities prevent name collisions and remap opening hosts without duplicating overlapping rooms',()=>{
  const wall=candidate('w1',.2,.2),door={...wall,id:'d1',kind:'door' as const,wallId:'w1'},other=candidate('wrong-region',.8,.2)
  const proposal=regionalProposal({...empty,candidates:[measured[0],wall,door,other]},0,[measured[0]])
  expect(proposal.candidates.map(item=>item.id)).toEqual(['cv_wall_0','region1_w1','region1_d1'])
  expect(proposal.candidates[2].wallId).toBe('region1_w1');expect(proposal.candidates[0].points).toEqual(measured[0].points)
  expect(measured.map(regionOwner)).toEqual([0,1,2,3])
})
test('a failed region cancels its siblings and never returns a partial building as complete',async()=>{
  let cancelled=0
  await expect(readRegions(source,new AbortController().signal,async(input,signal)=>{
    if(input.pass==='global-understanding')return empty
    if(input.pass==='reconstruct-region-1')throw new Error('region failed')
    await new Promise<void>((resolve)=>{if(signal.aborted){cancelled++;resolve()}else signal.addEventListener('abort',()=>{cancelled++;resolve()},{once:true})})
    signal.throwIfAborted();return empty
  },async()=>{})).rejects.toThrow('region failed')
  expect(cancelled).toBe(3)
})
