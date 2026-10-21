import {expect,test} from 'bun:test'
import {reconstructionStarted,reconstructionUpdate,reconstructionPhase,useReconstruction} from '../src/cloud/reconstructionState'
import {reconstructionContext,sameReconstructionSource} from '../src/cloud/reconstructionContext'
import {useProject} from '../src/state/project'
import {fixtureProject} from '../src/domain/fixture'

function setup(){
  const project=fixtureProject('Replacement progress');project.buildings[0].levels[0].sourceId='old-source'
  useProject.getState().setReadOnly(false);useProject.getState().setProject(project);useReconstruction.getState().clear()
  return reconstructionContext(project,project.buildings[0].levels[0].id)
}
test('old cached results cannot hide the progress of a newly started reconstruction',()=>{
  const context=setup()
  useReconstruction.getState().update({...context,status:'pending',job_status:'queued',startedAt:Date.now(),message:'Preparing floor plan'})
  reconstructionUpdate(context,{status:'accepted',job_status:'completed'},'old')
  expect(useReconstruction.getState().current?.analysisId).toBeUndefined()
  reconstructionStarted(context,'new',{status:'pending',job_status:'running'})
  reconstructionUpdate(context,{status:'failed',job_status:'failed'},'old')
  expect(useReconstruction.getState().current?.analysisId).toBe('new');expect(useReconstruction.getState().current?.status).toBe('pending')
  reconstructionUpdate(context,{status:'accepted',job_status:'completed'},'new')
  expect(useReconstruction.getState().current?.status).toBe('accepted');useReconstruction.setState({current:undefined})
})

test('late results and uploads from a replaced plan cannot revive its modal or overwrite new progress',()=>{
  const old=setup()
  reconstructionStarted(old,'old-job',{status:'pending',job_status:'running'})
  useProject.getState().editProject(project=>{project.buildings[0].levels[0].sourceId='replacement';return project})
  const context=reconstructionContext(useProject.getState().project!,old.levelId)
  expect(sameReconstructionSource(useReconstruction.getState().current,context)).toBe(false)
  useReconstruction.getState().clear()
  reconstructionUpdate(old,{status:'ready',job_status:'completed'},'old-job','Needs correction: old geometry')
  reconstructionStarted(old,'late-upload',{status:'pending',job_status:'queued'})
  expect(useReconstruction.getState().current).toBeUndefined()
  reconstructionStarted(context,'replacement-job',{status:'pending',job_status:'running'})
  reconstructionUpdate(old,{status:'failed',job_status:'failed'},undefined,'Old upload failed')
  expect(useReconstruction.getState().current?.analysisId).toBe('replacement-job')
  useReconstruction.getState().clear();useProject.getState().setProject(null)
})

test('a shared source on another floor has separate reconstruction progress',()=>{
  const context=setup(),upper={...context,levelId:'upper-floor'}
  reconstructionStarted(context,'ground-job',{status:'pending',job_status:'running'})
  expect(sameReconstructionSource(useReconstruction.getState().current,upper)).toBe(false)
  reconstructionUpdate(upper,{status:'ready',job_status:'completed'},'upper-job')
  expect(useReconstruction.getState().current?.analysisId).toBe('ground-job')
  useReconstruction.getState().clear();useProject.getState().setProject(null)
})

test('ready, blocked, failed and cancelled results never mark the 3D model stage complete',()=>{
  for(const status of ['pending','ready','failed','cancelled','rejected'])expect(reconstructionPhase({status,job_status:'completed'})).toBe(1)
  expect(reconstructionPhase({status:'pending',job_status:'queued'},'Uploading the original floor plan…')).toBe(0)
  expect(reconstructionPhase({status:'accepted',job_status:'completed'})).toBe(3)
})
