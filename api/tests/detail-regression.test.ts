import {expect,test} from 'bun:test'
import {retainDetailWarning} from '../src/modules/plan-analysis/detail-regression'
import {fixture} from './helpers'
import type {AnalysisJob,Intelligence} from '../src/contracts/analysis'
test('an incomplete rewrite of the same source requires review while complete and unrelated models are unaffected',()=>{
  const project=fixture(),level=project.buildings[0].levels[0];level.sourceId='source'
  level.walls=Array.from({length:40},(_,index)=>({...level.walls[0],id:`w${index}`}))
  const input={sourceId:'source',levelId:level.id,options:{purpose:'rebuild'}} as AnalysisJob
  const proposal={candidates:Array.from({length:14},(_,index)=>({id:`new${index}`,kind:'wall',points:[{x:.1,y:.1},{x:.9,y:.1}]}))} as Intelligence
  const result=retainDetailWarning(project,input,proposal,{status:'ready',issues:[]})
  expect(result.issues[0].code).toBe('DETAIL_REGRESSION');expect(result.status).toBe('needs-review')
  expect(retainDetailWarning(project,{...input,sourceId:'new-source'},proposal,{status:'ready',issues:[]}).status).toBe('ready')
  expect(retainDetailWarning(project,input,{...proposal,candidates:[...proposal.candidates,...proposal.candidates]}, {status:'ready',issues:[]}).status).toBe('ready')
  level.walls=[]
  expect(retainDetailWarning(project,input,proposal,{status:'ready',issues:[]},{walls:49,features:5119}).issues[0].code).toBe('SOURCE_DETAIL_INCOMPLETE')
})
