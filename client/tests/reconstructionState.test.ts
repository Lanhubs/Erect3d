import {expect,test} from 'bun:test'
import {reconstructionStarted,reconstructionUpdate,useReconstruction} from '../src/cloud/reconstructionState'
test('old cached results cannot hide the progress of a newly started reconstruction',()=>{
  useReconstruction.setState({current:undefined})
  useReconstruction.getState().update({projectId:'qa',status:'pending',job_status:'queued',startedAt:Date.now(),message:'Preparing floor plan'})
  reconstructionUpdate('qa',{status:'accepted',job_status:'completed'},'old')
  expect(useReconstruction.getState().current?.analysisId).toBeUndefined()
  reconstructionStarted('qa','new',{status:'pending',job_status:'running'})
  reconstructionUpdate('qa',{status:'failed',job_status:'failed'},'old')
  expect(useReconstruction.getState().current?.analysisId).toBe('new');expect(useReconstruction.getState().current?.status).toBe('pending')
  reconstructionUpdate('qa',{status:'accepted',job_status:'completed'},'new')
  expect(useReconstruction.getState().current?.status).toBe('accepted');useReconstruction.setState({current:undefined})
})
