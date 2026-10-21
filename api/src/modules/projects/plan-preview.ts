import type {Database} from '../../db/connection'
import type {Actor} from '../auth/session'
import {authorize} from '../../security/permissions'
import {loadDocument} from './documents'
import {createPlanPreview,type PlanPreview} from '../../../../client/src/domain/planPreview'

export function planPreviews(db:Database){
  const cache=new Map<string,PlanPreview>()
  return async(actor:Actor,projectId:string)=>{
    // Permission is checked even on cache hits and conditional requests.
    const access=await authorize(db,actor,projectId),key=`${projectId}:${access.revision}`
    const previous=cache.get(key)
    if(previous){cache.delete(key);cache.set(key,previous);return previous}
    const snapshot=await loadDocument(db,projectId),preview=createPlanPreview(snapshot.document,snapshot.revision)
    cache.set(`${projectId}:${snapshot.revision}`,preview)
    while(cache.size>128)cache.delete(cache.keys().next().value!)
    return preview
  }
}
