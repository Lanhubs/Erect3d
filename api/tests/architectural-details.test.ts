import {expect,test} from 'bun:test'
import {fixture} from './helpers'
import {expandReconstruction,compactReconstructionSchema} from '../src/modules/ai/compact-reconstruction'
import {buildReconstruction} from '../src/modules/plan-analysis/reconstruction'
import {projectSchema} from '../src/contracts/project'
import {reconcile} from '../src/modules/ai/reconcile'
import {inspectReconstruction} from '../src/workers/validated-reconstruction'
import {repairContext} from '../src/workers/repair-context'
import {architecturalRequirements} from '../src/contracts/architectural-requirements'
import type {AnalysisInput} from '../src/contracts/analysis'
const points=[[.2,.2],[.8,.2],[.8,.8],[.2,.8]]
function source(){return expandReconstruction({buildingType:'office',footprint:points,strokeLabels:{},
 walls:points.map((p,i)=>({id:`w${i}`,points:[p,points[(i+1)%4]],thickness:.02})),
 boundaries:[{id:'entrance',points:[[.3,.2],[.5,.2],[.5,.1],[.3,.1]]},{id:'proposal',points:[[.6,.2],[.8,.2]]}],
 openings:[{id:'entry',kind:'door',wallId:'w0',points:[[.34,.2],[.46,.2]],doorStyle:'double',doorLeafStyle:'glazed'},
 {id:'view',kind:'window',wallId:'w1',points:[[.8,.35],[.8,.55]],windowConstruction:{mullions:2,transoms:1,frameDepth:.08}}],
 rooms:[{id:'lobby',name:'Reception',points}],columns:[],stairs:[],fixtures:[],warnings:[],
 architecturalRequirements:{typology:'office',systems:[
 {id:'canopy',name:'Depicted entrance canopy',kind:'articulation',profile:'canopy',material:'concrete',side:'right',boundaryId:'entrance',origin:'detected',evidence:'Entrance projection traced from source',parameters:{height:2.8,depth:1,thickness:.18,spacing:1}},
 {id:'fins',name:'Optional shading',kind:'articulation',profile:'fins',material:'metal',boundaryId:'proposal',origin:'design-proposal',evidence:'Anchored to east front bay',assumptions:['Shading depth is a proposed design decision'],parameters:{height:3,depth:.3,thickness:.08,spacing:.7}},
 ]}})}
function setup(){const project=fixture(),level=project.buildings[0].levels[0]
 const input:AnalysisInput={sourceAssetId:'asset',sourceId:'source',levelId:level.id,calibration:{a:{x:0,z:0},b:{x:1000,z:0},knownMetres:10,metresPerPixel:.01,method:'manual'},deterministicCandidates:[],options:{mode:'full',complex:false,engine:'backend',purpose:'rebuild',designMode:'faithful',cloudConsent:true}}
 return {project,input}}
test('source outlines erect only their editable semantic architecture and keep proposals separate from drawn geometry',()=>{
 const {project,input}=setup(),proposal=source(),before=JSON.stringify(project)
 const result=buildReconstruction(project,input,'details',proposal,proposal.candidates,{width:1000,height:1000},true),building=result.buildings[0],level=building.levels[0]
 expect(projectSchema.safeParse(result).success).toBe(true);expect(JSON.stringify(project)).toBe(before)
 expect(level.walls).toHaveLength(4);expect(level.rooms).toHaveLength(1)
 expect(level.doors[0]).toMatchObject({style:'double',leafStyle:'glazed'});expect(level.doors[0].width).toBeCloseTo(1.2)
 expect(level.windows[0]).toMatchObject({mullions:2,transoms:1,frameDepth:.08})
 expect(result.interpretation![level.windows[0].id].inferredFields).toContain('height')
 expect(result.interpretation![level.windows[0].id].inferredFields).not.toContain('mullions')
 const [canopy,fins]=building.systems!.systems
 expect(canopy).toMatchObject({kind:'articulation',origin:'detected',visible:true,footprint:[{x:3,z:2},{x:5,z:2},{x:5,z:1},{x:3,z:1}]})
 expect(fins).toMatchObject({origin:'design-proposal',visible:false,assumptions:['Shading depth is a proposed design decision']})
 expect(Object.keys(result.interpretation||{})).not.toContain('entrance')
 expect(building.roofSections?.[0].footprint.every(p=>p.z>=2)).toBe(true)
 expect(()=>buildReconstruction(project,input,'details',{...proposal,architecturalRequirements:undefined},proposal.candidates,{width:1000,height:1000},true)).toThrow('named semantic system')
 const missing={...proposal,architecturalRequirements:{...proposal.architecturalRequirements!,systems:proposal.architecturalRequirements!.systems.map(s=>({...s,boundaryId:'absent'}))}}
 expect(()=>buildReconstruction(project,input,'details',missing,proposal.candidates.filter(c=>c.kind!=='architectural-boundary'),{width:1000,height:1000},true)).toThrow('source boundary')
})
test('curved architectural outlines survive reconciliation without being downgraded to invalid wall strokes',()=>{
 const proposal=source(),outline=proposal.candidates.find(c=>c.id==='proposal')!
 outline.points=[{x:.8,y:.5},{x:.5,y:.8}];outline.curve={center:{x:.5,y:.5},radius:.3,startAngle:0,endAngle:Math.PI/2}
 const merged=reconcile([], [proposal],'full',{width:1000,height:1000,metresPerPixel:.01})
 const candidate=merged.candidates.find(c=>c.id==='proposal')!
 expect(candidate.confidence).toBe(.8);expect(candidate.curve).toEqual(outline.curve)
})
test('orphan architectural repair names every failed source ID and carries the established semantic requirements',()=>{
 const {project,input}=setup(),proposal=source(),unowned={...proposal,architecturalRequirements:undefined}
 const quality=inspectReconstruction(project,input,'details',unowned,{width:1000,height:1000})
 expect(quality.status).toBe('blocked')
 expect(quality.issues.filter(i=>i.code==='ARCHITECTURE_OWNER_REQUIRED').map(i=>i.candidateId)).toEqual(['entrance','proposal'])
 const context=repairContext({bytes:new Uint8Array(),mime:'image/png',width:1000,height:1000,pass:'validated-model-repair',model:'fake',candidates:[]},proposal,quality)
 expect(context.architecturalRequirements).toBe(proposal.architecturalRequirements)
 expect(context.validationIssues?.every(text=>text.includes('Review '))).toBe(true)
 expect(compactReconstructionSchema().required).toContain('architecturalRequirements')
 expect(compactReconstructionSchema().required).toContain('boundaries')
 const malformed={typology:'office',systems:[{id:'core',name:'Core',kind:'core',boundaryId:'entrance',origin:'detected',evidence:'Source core',parameters:{floorHeight:3.4}}]}
 expect(architecturalRequirements.safeParse(malformed).success).toBe(false)
 expect(architecturalRequirements.safeParse({...malformed,systems:malformed.systems.map(s=>({...s,parameters:{height:3.4}}))}).success).toBe(true)
 expect(JSON.stringify(compactReconstructionSchema())).not.toContain('"oneOf"')
})
test('a spiral exit retains a dedicated circulation system instead of a tall balcony guard',()=>{
 const {project,input}=setup(),proposal=source()
 input.options.designMode='creative'
 proposal.candidates=proposal.candidates.filter(c=>c.id!=='proposal')
 proposal.architecturalRequirements!.systems=[{id:'spiral',name:'External spiral exit',kind:'spiral-stair',boundaryId:'entrance',origin:'inferred',evidence:'Circular stair within the source platform',assumptions:['Rise connects the selected floor only'],parameters:{height:3.2,radius:.5,width:.35,riserHeight:.17,turnHeight:3.2}}]
 const result=buildReconstruction(project,input,'spiral',proposal,proposal.candidates,{width:1000,height:1000},true)
 expect(result.buildings[0].systems!.systems[0]).toMatchObject({kind:'spiral-stair',center:{x:4,z:1.5},radius:.5,height:3.2})
 const before=JSON.stringify(proposal)
 proposal.architecturalRequirements!.systems[0].parameters.radius=.2
 const quality=inspectReconstruction(project,input,'mismatch',proposal,{width:1000,height:1000})
 expect(quality.issues.filter(issue=>issue.severity==='error')).toEqual([expect.objectContaining({code:'ARCHITECTURE_SOURCE_MISMATCH',candidateId:'entrance',message:expect.stringContaining('measured 0.500 m')})])
 proposal.architecturalRequirements!.systems[0].parameters.radius=.5
 expect(JSON.stringify(proposal)).toBe(before)
 proposal.architecturalRequirements!.systems=[{id:'wrong',name:'Wrong substitute',kind:'articulation',profile:'balcony',boundaryId:'entrance',origin:'inferred',evidence:'Source stair incorrectly mapped to balcony',parameters:{height:28,depth:1,thickness:.2,spacing:1}}]
 expect(()=>buildReconstruction(project,input,'wrong',proposal,proposal.candidates,{width:1000,height:1000},true)).toThrow('guard height')
})
