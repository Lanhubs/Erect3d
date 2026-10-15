import { expect,test } from 'bun:test'
import { fixtureProject } from '../src/domain/fixture'
import { defaultRoof } from '../src/domain/types'
import type { AnalysisInput,Candidate,Intelligence } from '../../api/src/contracts/analysis'
import { convertProposal,imageToWorld } from '../src/intelligence/convertProposal'
import { modelContext } from '../src/intelligence/modelContext'
import { confirmManualChanges } from '../src/intelligence/provenance'
import { enhanceProposal } from '../../api/src/modules/ai/enhancement'
import { applyDesigns } from '../src/intelligence/designCompletion'
import { sameEvidenceScale } from '../src/cloud/localEvidence'
import { reconcile } from '../../api/src/modules/ai/reconcile'
const base={ confidence:.9,evidence:'Measured source gap',uncertainties:[],needsReview:true as const }
function setup() {
  const project=fixtureProject(),level=project.buildings[0].levels[0]
  const input:AnalysisInput={ sourceAssetId:'asset',sourceId:'source',levelId:level.id,
    calibration:{ a:{ x:100,z:50 },b:{ x:200,z:50 },knownMetres:2,metresPerPixel:.02 },alignment:{ x:0,z:0 },
    options:{ mode:'structure',complex:false,purpose:'enhance',cloudConsent:true },deterministicCandidates:[] }
  return { project,level,input }
}
test('existing walls and doors round-trip through original-image coordinates without changing model IDs or geometry',()=>{
  const { project,level,input }=setup(),context=modelContext(project,input,1000,700)
  const wall=context.find(candidate=>candidate.targetId===level.walls[0].id)!
  expect(imageToWorld(wall.points[0],1000,700,input)).toEqual(level.walls[0].start)
  expect(imageToWorld(wall.points[1],1000,700,input)).toEqual(level.walls[0].end)
  expect(context.find(candidate=>candidate.targetId===level.doors[0].id)?.wallId).toBe(level.doors[0].wallId)
})
test('corrections update one hosted door while preserving its veranda and finish, and a preview cannot mutate the original',()=>{
  const { project,level,input }=setup(),door=level.doors[0]
  door.style='glazed';door.material='timber';door.veranda={ width:2.4,depth:1.5,side:'right',covered:true,railing:true,roofShape:'shed',floorMaterial:'tile' }
  const before=structuredClone(project),context=modelContext(project,input,1000,700),candidate=context.find(candidate=>candidate.targetId===door.id)!
  const result=convertProposal(project,input,'analysis',[{ ...candidate,id:'door-correction',doorStyle:'double' }],{ width:1000,height:700 })
  const updated=result.buildings[0].levels[0].doors.find(item=>item.id===door.id)!
  expect(updated.style).toBe('double');expect(updated.material).toBe('timber');expect(updated.veranda).toEqual(door.veranda)
  expect(result.buildings[0].levels[0].doors).toHaveLength(level.doors.length);expect(project).toEqual(before)
  expect(result.buildings[0].roof).toEqual(project.buildings[0].roof)
})
test('unchanged detections are discarded and new openings keep an existing host after alias reconciliation',()=>{
  const { project,level,input }=setup(),context=modelContext(project,input,1000,700),wall=context[0]
  const proposal:Intelligence={ coordinatesVersion:1,coordinateSystem:'normalized-image-top-left',warnings:[],candidates:[
    { ...wall,id:'same-wall',targetId:undefined },{ ...base,id:'new-door',kind:'door',wallId:'same-wall',points:[{ x:.4,y:wall.points[0].y },{ x:.45,y:wall.points[0].y }] }] }
  const enhanced=enhanceProposal(proposal,context)
  expect(enhanced.candidates).toHaveLength(1);expect(enhanced.candidates[0].wallId).toBe(level.walls[0].id)
})
test('manual changes confirm properties without mutating previous history; legacy existing properties stay protected',()=>{
  const { project,level }=setup(),before=structuredClone(project),next=structuredClone(project)
  next.buildings[0].levels[0].walls[0].height=3.5;confirmManualChanges(project,next)
  expect(next.interpretation?.[level.walls[0].id].confirmedFields).toContain('height')
  expect(next.interpretation?.[level.walls[0].id].confirmedFields).toContain('material');expect(project).toEqual(before)
  const detected=structuredClone(project);detected.interpretation={ [level.walls[0].id]:{ origin:'detected',confirmedFields:[] } }
  const changed=structuredClone(detected);changed.buildings[0].levels[0].walls[0].height=3.5;confirmManualChanges(detected,changed)
  expect(changed.interpretation?.[level.walls[0].id].confirmedFields).toEqual(['height'])
})
test('roof alternatives only affect explicit design selection and preserve one roof over the architectural footprint',()=>{
  const { project,level }=setup(),before=structuredClone(project),design={ ...base,id:'hip',kind:'roof' as const,label:'Hip roof',rationale:'Selected alternative',origin:'inferred' as const,roof:{ ...defaultRoof,shape:'hip' as const } }
  const result=applyDesigns(project,level.id,[design]);expect(result.buildings[0].roof?.shape).toBe('hip');expect(project).toEqual(before)
  expect(result.buildings[0].levels[0].walls).toEqual(level.walls)
  expect(()=>applyDesigns(project,level.id,[design,{ ...design,id:'other' }])).toThrow('only one roof')
})
test('evidence with an obsolete calibration origin cannot be reused just because its pixel scale matches',()=>{
  const { input }=setup();expect(sameEvidenceScale(input.calibration,{ ...input.calibration,a:{ x:0,z:0 } })).toBe(false)
  expect(sameEvidenceScale(input.calibration,{ ...input.calibration,method:'manual' })).toBe(true)
})

test('rejected existing false geometry becomes an explicit removal, while unknown measurement IDs cannot delete model entities',()=>{
  const { project,level,input }=setup(),context=modelContext(project,input,1000,700)
  const rejected:Intelligence={ coordinatesVersion:1,coordinateSystem:'normalized-image-top-left',warnings:[],candidates:[],
    dispositions:[{ candidateId:level.walls[0].id,decision:'reject',reason:'Visible dimension leader, not a wall' },
      { candidateId:'annotation-only',decision:'reject',reason:'Outside building' }] }
  const enhanced=enhanceProposal(reconcile([], [rejected],'structure',undefined,context),context)
  expect(enhanced.candidates).toHaveLength(1)
  expect(enhanced.candidates[0].action).toBe('remove');expect(enhanced.candidates[0].targetId).toBe(level.walls[0].id)
  expect(level.walls).toHaveLength(7)
})

test('removal preview cannot orphan hosted openings, mutate the original or silently remove additional elements',()=>{
  const { project,level,input }=setup(),context=modelContext(project,input,1000,700),wall=context.find(item=>item.targetId===level.walls[0].id)!
  const before=structuredClone(project),removed={ ...wall,action:'remove' as const }
  expect(()=>convertProposal(project,input,'review',[removed],{ width:1000,height:700 })).toThrow('still hosts')
  const hosted=context.filter(item=>item.wallId===wall.targetId).map(item=>({ ...item,action:'remove' as const }))
  const after=convertProposal(project,input,'review',[removed,...hosted],{ width:1000,height:700 }).buildings[0].levels[0]
  expect(after.walls).toHaveLength(level.walls.length-1)
  expect(after.windows).toHaveLength(level.windows.length-hosted.filter(item=>item.kind==='window').length)
  expect(after.rooms).toEqual(level.rooms);expect(project).toEqual(before)
})
