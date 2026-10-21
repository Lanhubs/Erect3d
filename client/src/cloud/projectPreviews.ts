import {createPlanPreview,type PlanPreview} from '../domain/planPreview'
import {api} from './api'
import {getTask,putTask,repository} from './cache'
import {recordKey} from './types'
import {documentChanges} from '../../../api/client'

let running=0
const waiting:(()=>void)[]=[]
const inflight=new Map<string,Promise<PlanPreview>>()
async function limited<T>(job:()=>Promise<T>):Promise<T>{
  await new Promise<void>(resolve=>{waiting.push(resolve);pump()})
  try{return await job()}finally{running--;pump()}
}
function pump(){while(running<2&&waiting.length){running++;waiting.shift()!()}}
export function loadProjectPreview(userId:string,projectId:string,revision=0){
  const key=`${userId}/plan-preview/${projectId}/${revision}`
  if(inflight.has(key))return inflight.get(key)!
  const request=limited(async()=>{
    const record=await repository.get(recordKey(userId,projectId))
    if(record&&(record.pending||record.conflict||documentChanges(record.base.document,record.draft).length))return createPlanPreview(record.draft,record.base.revision)
    const saved=await getTask<PlanPreview>(key)
    if(saved)return saved
    try{
      const preview=await api.request<PlanPreview>(`/projects/${encodeURIComponent(projectId)}/plan-preview`)
      await putTask(key,preview);return preview
    }catch(error){if(record)return createPlanPreview(record.draft,record.base.revision);throw error}
  }).finally(()=>inflight.delete(key))
  inflight.set(key,request);return request
}
