import {expect,test} from 'bun:test'
import type {Candidate,Intelligence} from '../src/contracts/analysis'
import {alignOpeningHosts} from '../src/workers/opening-hosts'
const base={confidence:.9,evidence:'Visible source wall',uncertainties:[],needsReview:true as const}
const wall=(id:string,a:number,b:number,y=.4):Candidate=>({...base,id,kind:'wall',points:[{x:a,y},{x:b,y}],thickness:.003})
const model=(candidates:Candidate[]):Intelligence=>({coordinatesVersion:1,coordinateSystem:'normalized-image-top-left',warnings:[],candidates})
const opening:Candidate={...base,id:'door',kind:'door',wallId:'left',points:[{x:.4,y:.4},{x:.5,y:.4}]}
test('two source fragments flanking a semantic opening become one continuous editable host',()=>{
 const source=model([wall('left',.1,.4),wall('right',.5,.9),opening,{...opening,id:'window',kind:'window',wallId:'right',points:[{x:.7,y:.4},{x:.8,y:.4}]}]),before=structuredClone(source)
 const result=alignOpeningHosts(source,1000,800),hosts=result.candidates.filter(c=>c.kind==='wall')
 expect(hosts).toHaveLength(1);expect(hosts[0].points).toEqual([{x:.1,y:.4},{x:.9,y:.4}])
 expect(result.candidates.filter(c=>c.wallId).every(c=>c.wallId===hosts[0].id)).toBe(true)
 expect(source).toEqual(before)
})
test('a lone fragment or separate parallel band cannot fabricate an opening host',()=>{
 const lone=alignOpeningHosts(model([wall('left',.1,.4),opening]),1000,800)
 expect(lone.candidates.filter(c=>c.kind==='wall')[0].points[1].x).toBe(.4)
 const separate=alignOpeningHosts(model([wall('left',.1,.4),wall('other',.5,.9,.43),opening]),1000,800)
 expect(separate.candidates.filter(c=>c.kind==='wall')).toHaveLength(2)
})
