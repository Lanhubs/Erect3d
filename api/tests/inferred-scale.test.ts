import {expect,test} from 'bun:test'
import type {AnalysisInput,Intelligence,Candidate} from '../src/contracts/analysis'
import {reconstructionScale} from '../src/modules/plan-analysis/reconstruction-scale'
import {coveredStroke} from '../src/workers/covered-stroke'
const base={confidence:.8,evidence:'Source geometry',uncertainties:[],needsReview:true as const}
const candidates:Candidate[]=[{...base,id:'wall',kind:'wall',points:[{x:.2,y:.2},{x:.8,y:.2}],thickness:.008},
  ...[.3,.5,.7].map((x,i)=>({...base,id:`door${i}`,kind:'door' as const,points:[{x,y:.2},{x:x+.03,y:.2}],doorStyle:'flush' as const}))]
const proposal:Intelligence={coordinatesVersion:1,coordinateSystem:'normalized-image-top-left',candidates,warnings:[]}
const input:AnalysisInput={sourceAssetId:'asset',sourceId:'source',levelId:'level',calibration:{a:{x:0,z:0},b:{x:1000,z:0},knownMetres:12,metresPerPixel:.012,method:'auto'},options:{mode:'full',purpose:'rebuild',engine:'backend',complex:false,cloudConsent:true},deterministicCandidates:[]}
test('missing AI scale uses the building and consistent door evidence, independently of sheet margins',()=>{
 const small=reconstructionScale(input,proposal,1000,800)
 const padded={...proposal,candidates:proposal.candidates.map(c=>({...c,thickness:c.thickness?c.thickness/5:undefined,points:c.points.map(p=>({x:p.x/5,y:p.y/5}))}))}
 const large=reconstructionScale(input,padded,5000,4000)
 expect(small.calibration.metresPerPixel).toBeCloseTo(.03)
 expect(large.calibration.metresPerPixel).toBeCloseTo(small.calibration.metresPerPixel)
 expect(small.calibration.basis).toBe('door-symbols');expect(small.calibration.method).toBe('auto')
 expect(reconstructionScale({...input,calibration:{...input.calibration,method:'manual'}},proposal,1000,800).calibration).toEqual({...input.calibration,method:'manual'})
})
test('native wall bands suppress only fully covered edge evidence, preserving extensions and nearby partitions',()=>{
 const walls=[{x1:20,y1:50,x2:120,y2:50,thicknessPixels:8}]
 expect(coveredStroke({horizontal:true,start:25,end:115,fixed:46,stroke:1},walls)).toBe(true)
 expect(coveredStroke({horizontal:true,start:25,end:160,fixed:46,stroke:1},walls)).toBe(false)
 expect(coveredStroke({horizontal:true,start:25,end:115,fixed:60,stroke:1},walls)).toBe(false)
})
