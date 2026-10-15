import {analysisConnected,subscribeAnalysis} from './analysisEvents'
import type {AnalysisState} from './analysisStatus'
// One initial read, pushed progress, and one terminal read. Disconnected pending
// jobs use a non-overlapping slow fallback; completed jobs never poll.
export function watchAnalysis<T extends AnalysisState>(projectId:string,id:string,load:()=>Promise<T>,changed:(value:T)=>void,error:(error:Error)=>void,
  fallbackMs=15000) {
  let alive=true,current:T|undefined,inflight:Promise<void>|undefined,timer:ReturnType<typeof setTimeout>|undefined
  const pending=()=>!current || current.status==='pending'
  const schedule=()=>{clearTimeout(timer);if(alive && pending() && !analysisConnected(projectId))timer=setTimeout(()=>void refresh(),fallbackMs)}
  const refresh=()=>{
    if(!alive || inflight)return inflight || Promise.resolve()
    inflight=load().then(value=>{if(alive){current=value;changed(value)}}).catch(cause=>{if(alive)error(cause as Error)}).finally(()=>{inflight=undefined;schedule()})
    return inflight
  }
  const unsubscribe=subscribeAnalysis(projectId,(type,payload)=>{
    if(type==='connection.open'){clearTimeout(timer);if(pending())void refresh();return}
    if(type==='connection.close'){schedule();return}
    if(payload.analysisId!==id || !pending())return
    if(type==='analysis.progress' && current && payload.progress){
      current={...current,status:'pending',job_status:'running',progress:payload.progress as AnalysisState['progress']};changed(current)
    } else if(['analysis.ready','analysis.failed','analysis.cancelled','analysis.retrying'].includes(type))void refresh()
  })
  void refresh()
  return ()=>{alive=false;clearTimeout(timer);unsubscribe()}
}
