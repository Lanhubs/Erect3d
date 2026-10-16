import {expect,test} from 'bun:test'
import {compactReconstructionSchema,compactSourceFeatures,expandReconstruction} from '../src/modules/ai/compact-reconstruction'
import {analysisPasses} from '../src/modules/ai/passes'
const source={buildingType:'arena',footprint:[[.1,.1],[.9,.1],[.9,.9],[.1,.9]],strokeLabels:{},
  walls:[{id:'w1',points:[[.1,.1],[.9,.1]],thickness:.002}],
  openings:[{id:'d1',kind:'door',wallId:'w1',points:[[.3,.1],[.4,.1]],doorStyle:'double'}],
  rooms:[{id:'court',name:'Basketball court',roomCategory:'basketball-court',points:[[.3,.3],[.7,.3],[.7,.6],[.3,.6]]}],columns:[],stairs:[],fixtures:[],warnings:[]}
test('one compact interpretation retains exact geometry, hosts, sport context and review provenance',()=>{
  const result=expandReconstruction(source)
  expect(result.candidates[0].points).toEqual([{x:.1,y:.1},{x:.9,y:.1}]);expect(result.candidates[0].thickness).toBe(.002)
  expect(result.candidates[1]).toMatchObject({wallId:'w1',doorStyle:'double',needsReview:true})
  expect(result.candidates[2].roomCategory).toBe('basketball-court');expect(result.understanding?.buildingType).toBe('arena')
  expect(JSON.stringify(compactReconstructionSchema())).not.toContain('prefixItems')
  expect(compactReconstructionSchema().required).toContain('scale')
  expect((compactReconstructionSchema().properties as Record<string,unknown>).vision).toBeUndefined()
  expect(compactReconstructionSchema().required).toContain('windows')
  const glazed=expandReconstruction({...source,windows:[{id:'window-source',wallId:'w1',points:[[.5,.1],[.6,.1]],windowConstruction:{mullions:2}}]})
  expect(glazed.candidates.find(c=>c.id==='window-source')).toMatchObject({kind:'window',wallId:'w1',windowConstruction:{mullions:2}})
  expect(()=>expandReconstruction({...source,walls:[{id:'bad',points:[[.1,2],[.2,.1]]}]})).toThrow()
  const measured=result.candidates.filter(item=>item.kind==='wall')
  const refs=expandReconstruction({...source,walls:[],wallRefs:[0,0],strokeLabels:{0:'1'},scale:{a:[.3,.3],b:[.7,.3],knownMetres:28,origin:'annotated',evidence:'Standard FIBA basketball court'}},measured)
  expect(refs.candidates.filter(item=>item.kind==='wall')).toHaveLength(1);expect(refs.candidates[0].points).toEqual(measured[0].points)
  expect(refs.understanding?.scale?.origin).toBe('inferred')
  expect(()=>expandReconstruction({...source,wallRefs:[9]},measured)).toThrow()
  const hosted=expandReconstruction({...source,walls:[],wallRefs:[0],strokeLabels:{0:'1'},openings:[{id:'measured-door',kind:'door',wallRef:0,points:[[.3,.1],[.4,.1]]}]},measured)
  expect(hosted.candidates.find(item=>item.kind==='door')?.wallId).toBe(measured[0].id)
  expect(()=>expandReconstruction(source,measured)).toThrow()
})
test('compact interpretation keeps bounded native opening hints across the entire drawing',()=>{
 const items=Array.from({length:600},(_,i)=>({id:`cv_feature_${i}`,kind:'unknown' as const,points:[{x:i/600,y:.1},{x:i/600,y:.2}],confidence:.5,evidence:i===599?'Measured thin swing line':'Measured thin axis line',uncertainties:[],needsReview:true as const}))
 const before=JSON.stringify(items),hints=compactSourceFeatures(items)
 expect(hints).toHaveLength(256);expect(hints[0][0]).toBe('cv_feature_599')
 expect(Number(hints.at(-1)![1])).toBeGreaterThan(.98)
 expect(JSON.stringify(items)).toBe(before)
})
test('dense measurement grammar stays constant while every source label remains mandatory',()=>{
 const schema=compactReconstructionSchema(0)
 for(const count of [1,25,400,481,2000])expect(compactReconstructionSchema(count)).toEqual(schema)
 const wall=expandReconstruction(source).candidates[0]
 const measured=Array.from({length:481},(_,i)=>({...wall,id:`measured-${i}`}))
 const labels=Object.fromEntries(Array.from({length:20},(_,i)=>[String(i*25),'0'.repeat(Math.min(25,481-i*25))]))
 const input={...source,walls:[],openings:[],rooms:[],strokeLabels:labels}
 const result=expandReconstruction(input,measured)
 expect(result.candidates).toHaveLength(0);expect(result.dispositions).toHaveLength(481)
 const missing={...labels};delete missing['475']
 expect(()=>expandReconstruction({...input,strokeLabels:missing},measured)).toThrow('Every source measurement')
 expect(()=>expandReconstruction({...input,strokeLabels:{...labels,475:'00000'}},measured)).toThrow('Every source measurement')
 expect(()=>expandReconstruction({...input,strokeLabels:{...labels,475:'000003'}},measured)).toThrow()
 expect(()=>expandReconstruction({...input,strokeLabels:{...labels,extra:'0'}},measured)).toThrow('Every source measurement')
 expect(expandReconstruction({...input,strokeLabels:{}},[]).dispositions).toHaveLength(0)
})
test('direct reconstruction uses one coordinated pass for simple and dense plans',()=>{
  expect(analysisPasses('full',false,false,true,true)).toEqual(['reconstruct-model'])
  expect(analysisPasses('full',true,false,true,true)).toEqual(['reconstruct-model'])
  expect(analysisPasses('full',true,false,true,false)).toHaveLength(16)
  expect(analysisPasses('full',false,true,true,true)).toEqual(['reconstruct-model','architecture-completion'])
})
