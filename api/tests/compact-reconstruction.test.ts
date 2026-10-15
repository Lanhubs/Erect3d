import {expect,test} from 'bun:test'
import {compactReconstructionSchema,expandReconstruction} from '../src/modules/ai/compact-reconstruction'
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
test('simple direct reconstruction uses one pass and dense plans read four regions concurrently',()=>{
  expect(analysisPasses('full',false,false,true,true)).toEqual(['reconstruct-model'])
  expect(analysisPasses('full',true,false,true,true)).toEqual(['global-understanding','reconstruct-region-1','reconstruct-region-2','reconstruct-region-3','reconstruct-region-4'])
  expect(analysisPasses('full',true,false,true,false)).toHaveLength(16)
  expect(analysisPasses('full',false,true,true,true)).toEqual(['reconstruct-model','architecture-completion'])
})
