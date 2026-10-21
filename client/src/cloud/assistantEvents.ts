type Listener=(event:{runId:string;progress:string;status?:string})=>void
const listeners=new Map<string,Set<Listener>>()
export function assistantEvent(projectId:string,event:Parameters<Listener>[0]){for(const listener of listeners.get(projectId)||[])listener(event)}
export function subscribeAssistant(projectId:string,listener:Listener){
  const group=listeners.get(projectId)||new Set<Listener>();group.add(listener);listeners.set(projectId,group)
  return ()=>{group.delete(listener);if(!group.size)listeners.delete(projectId)}
}
