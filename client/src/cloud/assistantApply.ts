import {api,browserLock} from './api'
import {getTask,putTask} from './cache'
import {useProject} from '../state/project'
import type {CloudSession} from './useCloudProject'
import type {ApplyTask,AssistantRun} from './assistantTypes'
export async function finishAssistantApply(session:CloudSession,key:string,run:AssistantRun){
  return browserLock(`erect-assistant-apply:${key}`,async()=>{
  const task=await getTask<ApplyTask>(`${key}/apply`),engine=session.engine
  if(!task||task.runId!==run.id||task.historyRecorded||!engine)return
  await engine.refresh()
  if(engine.state!=='saved')throw new Error('Review the current sync state before completing this change.')
  useProject.getState().rememberAccepted(task.before)
  await putTask(`${key}/apply`,{...task,historyRecorded:true})
  })
}
export async function applyAssistantProposal(session:CloudSession,key:string,projectId:string,run:AssistantRun){
  const engine=session.engine
  if(!engine||!navigator.onLine)throw new Error('Connect to the server before applying this proposal.')
  if(useProject.getState().editLocked)throw new Error('An approved change is already being applied.')
  useProject.getState().finishPreview()
  useProject.getState().setEditLocked(true)
  try{
  let task=await getTask<ApplyTask>(`${key}/apply`)
  if(task?.runId!==run.id)task=undefined
  if(!task){
    await engine.sync()
    if(engine.state!=='saved'||engine.record.base.revision!==run.base_revision)throw new Error('The model changed. Prepare a new proposal before applying.')
    task={runId:run.id,operationId:crypto.randomUUID(),baseRevision:run.base_revision,before:structuredClone(useProject.getState().project!)}
    await putTask(`${key}/apply`,task)
  }
  const accepted=await api.request<{revision:number}>(`/projects/${projectId}/assistant/runs/${run.id}/apply`,'POST',{operationId:task.operationId,baseRevision:task.baseRevision})
  await finishAssistantApply(session,key,{...run,status:'applied',applied_revision:accepted.revision})
  }finally{useProject.getState().setEditLocked(false)}
}
