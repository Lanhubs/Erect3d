import {expect,test} from 'bun:test'
import type {Candidate,Intelligence,AnalysisInput} from '../src/contracts/analysis'
import {validateFootprint} from '../src/modules/plan-analysis/footprint-validation'
import {reconstructionScale} from '../src/modules/plan-analysis/reconstruction-scale'
import {sourceDetails} from '../src/workers/source-document'
import sharp from 'sharp'
import {buildableCandidates,modelQuality} from '../src/modules/plan-analysis/quality'
import {inspectReconstruction} from '../src/workers/validated-reconstruction'
import {fixture} from './helpers'
const ring=[{x:.1,y:.2},{x:.9,y:.2},{x:.9,y:.9},{x:.1,y:.9}]
const proposal:Intelligence={coordinatesVersion:1,coordinateSystem:'normalized-image-top-left',warnings:[],candidates:[],understanding:{
  buildingType:'house',footprint:ring,conventions:[],circulation:[],uncertainties:[],scale:{a:ring[0],b:ring[1],knownMetres:10,origin:'annotated',evidence:'10 m overall'}}}
const base={id:'room',kind:'room' as const,points:ring,confidence:.9,evidence:'Interior outline',uncertainties:[],needsReview:true as const}
test('source footprint rejects page-margin structures and crossed room polygons, while accepting a perimeter on the footprint',()=>{
  expect(()=>validateFootprint(proposal,[base],1000,800)).not.toThrow()
  expect(()=>validateFootprint(proposal,[{...base,id:'margin',points:[{x:.1,y:0},{x:.9,y:0},{x:.9,y:.1},{x:.1,y:.1}]}],1000,800)).toThrow('margins must stay empty')
  expect(()=>validateFootprint(proposal,[{...base,points:[ring[0],ring[2],ring[1],ring[3]]}],1000,800)).toThrow('polygon crosses')
})
test('source-only stairs outside the envelope do not block walls; connected structures still enforce the footprint',()=>{
  const guide:Candidate={...base,id:'stair',kind:'stair',points:[{x:.01,y:.01},{x:.08,y:.01},{x:.08,y:.08},{x:.01,y:.08}]}
  expect(()=>validateFootprint(proposal,[guide],1000,800)).not.toThrow()
  expect(()=>validateFootprint(proposal,[{...guide,targetLevelId:'upper'}],1000,800)).toThrow('margins must stay empty')
  expect(()=>validateFootprint(proposal,[{...guide,kind:'wall',points:guide.points.slice(0,2)}],1000,800)).toThrow('margins must stay empty')
  const line={...guide,points:guide.points.slice(0,2)}
  expect(buildableCandidates([base,guide,line]).map(item=>item.id)).toEqual(['room','stair'])
  expect(modelQuality({...proposal,candidates:[line]}).issues.map(issue=>issue.code)).toContain('INCOMPLETE_STAIR_GUIDE')
})
test('fixture corner evidence validates the same bounding box used by the editable asset converter',()=>{
  const fixture:Candidate={...base,id:'table',kind:'furniture',furnitureType:'dining-table',points:[{x:.3,y:.3},{x:.4,y:.4}]}
  expect(()=>validateFootprint(proposal,[fixture],1000,800)).not.toThrow()
  expect(()=>validateFootprint(proposal,[{...fixture,points:[{x:.3,y:.3},{x:.4,y:.3}]}],1000,800)).toThrow('has no area')
  expect(()=>validateFootprint(proposal,[{...fixture,points:[{x:.01,y:.01},{x:.2,y:.3}]}],1000,800)).toThrow('margins must stay empty')
})
test('server validation reports independent geometry errors together without altering or accepting the proposal',()=>{
  const project=fixture(),level=project.buildings[0].levels[0]
  const walls:Candidate[]=ring.map((p,i)=>({...base,id:`wall-${i}`,kind:'wall',points:[p,ring[(i+1)%4]],thickness:.01}))
  const column:Candidate={...base,id:'outside',kind:'column',points:[{x:0,y:0},{x:.05,y:0},{x:.05,y:.05},{x:0,y:.05}]}
  const door:Candidate={...base,id:'bad-door',kind:'door',wallId:'missing',points:[{x:.3,y:.2},{x:.4,y:.2}]}
  const original={...proposal,candidates:[...walls,column,door]},before=structuredClone(original)
  const input={sourceAssetId:'asset',sourceId:'source',levelId:level.id,calibration:{a:{x:0,z:0},b:{x:1000,z:0},knownMetres:10,metresPerPixel:.01,method:'auto' as const},
    deterministicCandidates:[],options:{mode:'rooms' as const,complex:false,engine:'backend' as const,purpose:'rebuild' as const,cloudConsent:true as const}}
  const quality=inspectReconstruction(project,input,'analysis',original,{width:1000,height:800})
  expect(quality.status).toBe('blocked');expect(quality.issues.filter(item=>item.severity==='error').map(item=>item.candidateId)).toEqual(['outside','bad-door'])
  expect(original).toEqual(before);expect(project.buildings[0].levels[0].walls).toHaveLength(1)
})
test('backend annotated scale applies only to a fresh automatic reconstruction and never replaces manual or enhancement scale',()=>{
  const input:AnalysisInput={sourceAssetId:'asset',sourceId:'source',levelId:'floor',calibration:{a:{x:0,z:0},b:{x:1000,z:0},knownMetres:12,metresPerPixel:.012,method:'auto'},
    deterministicCandidates:[],options:{mode:'rooms',complex:false,engine:'backend',purpose:'rebuild',cloudConsent:true}}
  expect(reconstructionScale(input,proposal,1000,800).calibration.metresPerPixel).toBe(.0125)
  expect(reconstructionScale({...input,calibration:{...input.calibration,method:'manual'}},proposal,1000,800).calibration.metresPerPixel).toBe(.012)
  expect(reconstructionScale({...input,options:{...input.options,purpose:'enhance'}},proposal,1000,800).calibration.metresPerPixel).toBe(.012)
})
test('large source images supply four overlapping server crops; small plans avoid extra provider images',async()=>{
  const bytes=await sharp({create:{width:2600,height:800,channels:3,background:'white'}}).png().toBuffer()
  const details=await sourceDetails(bytes,2600,800)
  expect(details).toHaveLength(4);expect(details[3].region).toEqual({x:.45,y:.45,width:.55,height:.55})
  expect((await sharp(details[0].bytes).metadata()).width).toBe(1430)
  expect(await sourceDetails(bytes,1000,800)).toEqual([])
})
