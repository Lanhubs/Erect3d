import {expect,test} from 'bun:test'
import type {Candidate,Intelligence} from '../src/contracts/analysis'
import {completeGarageOpenings} from '../src/workers/garage-openings'
const base={confidence:.8,evidence:'Source entrance',uncertainties:[],needsReview:true as const}
const room:Candidate={...base,id:'garage',kind:'room',label:'Garage',points:[{x:.1,y:.1},{x:.6,y:.1},{x:.6,y:.8},{x:.1,y:.8}]}
const entrance:Candidate={...base,id:'op_garage_vehicular_single',kind:'passage',points:[{x:.2,y:.8},{x:.5,y:.8}]}
const model=(label='Garage'):Intelligence=>({coordinatesVersion:1,coordinateSystem:'normalized-image-top-left',candidates:[{...room,label},entrance],warnings:[],
 understanding:{buildingType:'house',footprint:room.points,conventions:[],circulation:[],uncertainties:[],scale:{a:{x:.1,y:.1},b:{x:.6,y:.1},knownMetres:5,origin:'annotated',evidence:'Garage width 5 m'}}})
test('a source-anchored vehicle gap gains an editable inferred sectional door and boundary host',()=>{
 const original=model(),result=completeGarageOpenings(original,1000,800),door=result.candidates.find(c=>c.id===entrance.id)!
 expect(door).toMatchObject({kind:'door',doorStyle:'sectional',origin:'inferred',heightMetres:2.4})
 expect(result.candidates.find(c=>c.id===door.wallId)).toMatchObject({kind:'wall',origin:'inferred',points:[{x:.6,y:.8},{x:.1,y:.8}]})
 expect(original.candidates[1].kind).toBe('passage')
 expect(completeGarageOpenings(result,1000,800)).toEqual(result)
})
test('open carports, ordinary circulation and gaps away from a garage boundary stay open',()=>{
 expect(completeGarageOpenings(model('Open carport'),1000,800).candidates[1].kind).toBe('passage')
 const inside=model();inside.candidates[1]={...entrance,points:[{x:.2,y:.5},{x:.5,y:.5}]}
 expect(completeGarageOpenings(inside,1000,800).candidates[1].kind).toBe('passage')
 const corridor=model();corridor.candidates[1]={...entrance,id:'open-circulation'}
 expect(completeGarageOpenings(corridor,1000,800).candidates[1].kind).toBe('passage')
})
