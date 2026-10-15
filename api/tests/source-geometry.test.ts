import{expect,test}from'bun:test'
import sharp from'sharp'
import type{Candidate,Intelligence}from'../src/contracts/analysis'
import{sourceEnvelope}from'../src/workers/source-envelope'
import{alignOpeningHosts}from'../src/workers/opening-hosts'
import{validateFootprint}from'../src/modules/plan-analysis/footprint-validation'
import{buildableCandidates,modelQuality}from'../src/modules/plan-analysis/quality'
const base={confidence:.9,evidence:'Actual visible source band',uncertainties:[],needsReview:true as const}
const ring=[{x:.1,y:.1},{x:.5,y:.1},{x:.5,y:.9},{x:.1,y:.9}]
const proposal=(candidates:Candidate[]):Intelligence=>({coordinatesVersion:1,coordinateSystem:'normalized-image-top-left',candidates,warnings:[],
 understanding:{buildingType:'public',footprint:ring,conventions:[],circulation:[],uncertainties:[]}})
test('an estimated envelope fits nearby source-supported walls and cannot expand into blank margins or distant page marks',async()=>{
 const wall:Candidate={...base,id:'wall',kind:'wall',points:[{x:.4,y:.3},{x:.53,y:.3}],thickness:.01}
 const drawing=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="white"/><path d="M160 90H212" stroke="black" stroke-width="4"/></svg>')).png().toBuffer()
 const corrected=await sourceEnvelope(proposal([wall]),drawing)
 expect(corrected.understanding!.footprint.length).toBeGreaterThan(4)
 expect(()=>validateFootprint(corrected,[wall],400,300)).not.toThrow()
 const blank=await sharp({create:{width:400,height:300,channels:3,background:'white'}}).png().toBuffer()
 expect((await sourceEnvelope(proposal([wall]),blank)).understanding!.footprint).toEqual(ring)
 const far:Candidate={...wall,points:[{x:.8,y:.3},{x:.95,y:.3}]}
 const border=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><path d="M320 90H380" stroke="black" stroke-width="4"/></svg>')).png().toBuffer()
 expect((await sourceEnvelope(proposal([far]),border)).understanding!.footprint).toEqual(ring)
})
test('opening hosts are repaired within pixel tolerance without converting swung leaves or open routes into fabricated walls',()=>{
 const wall:Candidate={...base,id:'host',kind:'wall',points:[{x:.1,y:.3},{x:.8,y:.3}],thickness:.002}
 const door:Candidate={...base,id:'door',kind:'door',points:[{x:.3,y:.301},{x:.32,y:.301}]}
 const leaf:Candidate={...door,id:'leaf',points:[{x:.5,y:.3},{x:.5,y:.32}]}
 const result=alignOpeningHosts(proposal([wall,door,leaf]),1000,800)
 expect(result.candidates[1].wallId).toBe('host');expect(result.candidates[1].points.map(point=>point.y)).toEqual([.3,.3])
 expect(result.candidates[2].wallId).toBeUndefined();expect(door.wallId).toBeUndefined()
})
test('an open vomitory never creates a gap across the endpoint of a diagonal wall',()=>{
 const host:Candidate={...base,id:'diagonal',kind:'wall',points:[{x:.245,y:.732},{x:.34,y:.65}]}
 const opening:Candidate={...base,id:'vomitory',kind:'passage',wallId:host.id,points:[{x:.33,y:.65},{x:.35,y:.65}]}
 const door:Candidate={...opening,id:'door',kind:'door'}
 const result=alignOpeningHosts(proposal([host,opening,door]),708,551)
 expect(result.candidates[1].wallId).toBeUndefined();expect(result.candidates[1].points).toEqual(opening.points)
 expect(result.candidates[2].wallId).toBe(host.id)
 expect(buildableCandidates(result.candidates).map(item=>item.id)).not.toContain(opening.id)
})
test('a nearby structural column fits the envelope only when its edges have original pixel support',async()=>{
 const column:Candidate={...base,id:'column',kind:'column',points:[{x:.49,y:.3},{x:.52,y:.3},{x:.52,y:.34},{x:.49,y:.34}]}
 const drawing=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="white"/><rect x="196" y="90" width="12" height="12" fill="black"/></svg>')).png().toBuffer()
 const corrected=await sourceEnvelope(proposal([column]),drawing)
 expect(()=>validateFootprint(corrected,[column],400,300)).not.toThrow()
 const blank=await sharp({create:{width:400,height:300,channels:3,background:'white'}}).png().toBuffer()
 expect((await sourceEnvelope(proposal([column]),blank)).understanding?.footprint).toEqual(ring)
})
test('open circulation remains a source guide, unsupported fixtures remain reviewable, and quality notes do not hide scale warnings',()=>{
 const passage:Candidate={...base,id:'open',kind:'passage',points:[{x:.2,y:.2},{x:.3,y:.2}]}
 const furniture:Candidate={...base,id:'fixture',kind:'furniture',furnitureType:'unavailable-asset',points:ring}
 expect(buildableCandidates([passage,furniture])).toEqual([])
 const unknown:Candidate={...base,id:'unknown',kind:'unknown',points:ring}
 const quality=modelQuality(proposal([passage,furniture,...Array.from({length:150},(_,i)=>({...unknown,id:`unknown-${i}`}))]))
 expect(quality.issues).toHaveLength(4);expect(quality.issues.map(issue=>issue.code)).toContain('OPEN_CIRCULATION')
 expect(quality.issues.map(issue=>issue.code)).toContain('PROVISIONAL_SCALE')
})
