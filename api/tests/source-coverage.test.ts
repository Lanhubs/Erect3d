import {expect,test} from 'bun:test'
import {fixture} from './helpers'
import {sourceCoverage} from '../src/modules/plan-analysis/source-coverage'
import {needsSourceRepair,repairContext} from '../src/workers/repair-context'
import type {Intelligence} from '../src/contracts/analysis'
import {openingCoverage} from '../src/modules/plan-analysis/opening-coverage'
const p=(x:number,z:number)=>({x,z})
function roomFixture(){
 const project=fixture(),level=project.buildings[0].levels[0],ring=[p(0,0),p(4,0),p(4,3),p(0,3)]
 level.rooms=[{id:'bedroom',name:'Bedroom',polygon:ring,material:'oak'}]
 level.walls=ring.map((start,i)=>({id:`w${i}`,start:{...start},end:{...ring[(i+1)%4]},height:3,thickness:.15,material:'plaster'}))
 level.doors=[];level.windows=[];level.passages=[]
 project.interpretation={bedroom:{origin:'detected',confirmedFields:[],candidateId:'source-bedroom'}}
 return {project,level}
}
const proposal:Intelligence={coordinatesVersion:1,coordinateSystem:'normalized-image-top-left',candidates:[],warnings:[]}
test('a sealed room cannot pass completeness merely because other rooms have doors; windows are not access',()=>{
 const {project,level}=roomFixture()
 level.windows=[{id:'window',wallId:'w0',offset:1,width:1,height:1.2,sill:.8}]
 const issues=sourceCoverage(proposal,project,level.id)
 expect(issues).toEqual([expect.objectContaining({code:'ROOM_NO_ACCESS',candidateId:'source-bedroom'})])
 expect(needsSourceRepair({status:'needs-review',issues})).toBe(true)
 level.doors=[{id:'door',wallId:'w2',offset:1,width:.85,height:2.1,hinge:'left'}]
 expect(sourceCoverage(proposal,project,level.id)).toHaveLength(0)
})
test('an open living/dining boundary is valid circulation, and a tiny corner gap is not',()=>{
 const {project,level}=roomFixture()
 level.rooms[0].name='Living / dining'
 level.walls[0].start.x=.2
 expect(sourceCoverage(proposal,project,level.id).map(i=>i.code)).toContain('ROOM_NO_ACCESS')
 level.walls[0].start.x=1
 expect(sourceCoverage(proposal,project,level.id)).toHaveLength(0)
})
test('an annotated room dimension cannot measure a table inside it',()=>{
 const {project,level}=roomFixture()
 const drawing:Intelligence={...proposal,candidates:[{id:'dining',kind:'room',label:'Dining',points:[{x:.1,y:.1},{x:.7,y:.1},{x:.7,y:.7},{x:.1,y:.7}],confidence:.9,evidence:'Room boundary',uncertainties:[],needsReview:true}],
  understanding:{buildingType:'house',footprint:[],circulation:[],conventions:[],uncertainties:[],scale:{a:{x:.3,y:.4},b:{x:.4,y:.4},knownMetres:4,origin:'annotated',evidence:'Dining 4 m'}}}
 expect(sourceCoverage(drawing,project,level.id,{width:1000,height:800}).map(i=>i.code)).toContain('SCALE_REFERENCE_INTERIOR')
 drawing.understanding!.scale!.a.x=.1;drawing.understanding!.scale!.b.x=.7
 expect(sourceCoverage(drawing,project,level.id,{width:1000,height:800}).map(i=>i.code)).not.toContain('SCALE_REFERENCE_INTERIOR')
})
test('access repairs name the source room and retain its hosts plus original source bytes',()=>{
 const {project,level}=roomFixture(),issues=sourceCoverage(proposal,project,level.id),bytes=new Uint8Array([1,2])
 const room={id:'source-bedroom',kind:'room' as const,points:[{x:.1,y:.1}],confidence:.8,evidence:'Bedroom',uncertainties:[],needsReview:true as const}
 const context=repairContext({bytes,mime:'image/png',width:1000,height:800,candidates:[],pass:'reconstruct-model',model:'fake'}, {...proposal,candidates:[room]}, {status:'needs-review',issues})
 expect(context.bytes).toBe(bytes);expect(context.candidates[0]).toBe(room)
 expect(context.validationIssues?.join(' ')).toContain('Bedroom')
})
test('exterior-room glazing is checked per room, without inventing windows or imposing counts',()=>{
 const {project,level}=roomFixture()
 level.calibration={a:p(0,0),b:p(100,0),knownMetres:10,metresPerPixel:.1,method:'auto'}
 const drawing={...proposal,understanding:{buildingType:'house' as const,footprint:[{x:0,y:0},{x:.4,y:0},{x:.4,y:.3},{x:0,y:.3}],circulation:[],conventions:[],uncertainties:[]}}
 const issues=openingCoverage(drawing,project,level.id,{width:100,height:100})
 expect(issues[0]?.code).toBe('EXTERIOR_ROOM_OPENINGS_UNCHECKED')
 expect(needsSourceRepair({status:'needs-review',issues})).toBe(true)
 level.windows=[{id:'window',wallId:'w0',offset:1,width:1,height:1.2,sill:.8}]
 expect(openingCoverage(drawing,project,level.id,{width:100,height:100})).toHaveLength(0)
})
