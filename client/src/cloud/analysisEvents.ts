type Listener=(type:string,payload:Record<string,unknown>)=>void
const listeners=new Map<string,Set<Listener>>(),connections=new Set<string>()
export const analysisConnected=(projectId:string)=>connections.has(projectId)
export function analysisEvent(projectId:string,type:string,payload:Record<string,unknown>={}) {
  if(type==='connection.open')connections.add(projectId)
  if(type==='connection.close')connections.delete(projectId)
  listeners.get(projectId)?.forEach(listener=>listener(type,payload))
}
export function subscribeAnalysis(projectId:string,listener:Listener) {
  const group=listeners.get(projectId)||new Set<Listener>();group.add(listener);listeners.set(projectId,group)
  return ()=>{group.delete(listener);if(!group.size)listeners.delete(projectId)}
}
