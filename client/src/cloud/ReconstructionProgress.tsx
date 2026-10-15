import {useEffect,useState,useRef,useId} from 'react'
import {FiCheckCircle,FiClock,FiMoreHorizontal,FiX,FiAlertCircle} from 'react-icons/fi'
import {api} from './api'
import {analysisStatus} from './analysisStatus'
import {useReconstruction,reconstructionUpdate} from './reconstructionState'
export function ReconstructionProgress({projectId,details}:{projectId:string;details:()=>void}) {
  const current=useReconstruction(state=>state.current),[,tick]=useState(0),[error,setError]=useState('')
  const [expanded,setExpanded]=useState(false),element=useRef<HTMLElement>(null),panelId=useId()
  const state=current?.projectId===projectId?current:undefined,pending=state?.status==='pending'
  useEffect(()=>{if(!pending)return;const timer=setInterval(()=>tick(value=>value+1),1000);return()=>clearInterval(timer)},[pending])
  useEffect(()=>{
    if(!expanded)return
    const dismiss=(event:Event)=>{if(event instanceof KeyboardEvent?event.key==='Escape':!element.current?.contains(event.target as Node))setExpanded(false)}
    document.addEventListener('pointerdown',dismiss);document.addEventListener('keydown',dismiss)
    return()=>{document.removeEventListener('pointerdown',dismiss);document.removeEventListener('keydown',dismiss)}
  },[expanded])
  if(!state)return null
  const phase=state.message?.startsWith('Uploading')?0:pending?1:state.status==='accepted'?3:2
  const cancel=async()=>{try{await api.request(`/analysis/${state.analysisId}/cancel`,'POST');reconstructionUpdate(projectId,{status:'cancelled',job_status:'cancelled'},state.analysisId)}catch(cause){setError((cause as Error).message)}}
  const message=state.message || analysisStatus(state),elapsed=Math.floor((Date.now()-state.startedAt)/1000)
  const Icon=pending?FiClock:state.status==='accepted'?FiCheckCircle:FiAlertCircle
  const action=pending?'Show details':state.status==='accepted'?'Model details':'Review result'
  return <section ref={element} className="reconstruction-progress" aria-label="Reconstruction progress" data-pending={pending}>
    <button className="reconstruction-trigger" onClick={()=>setExpanded(value=>!value)} aria-expanded={expanded} aria-controls={panelId} title={message}>
      <Icon aria-hidden="true"/><strong role="status" aria-live="polite">{message}</strong>{pending && <small>{elapsed}s</small>}
      {pending && <progress aria-label="Processing floor plan"/>}
    </button>
    {pending && state.analysisId && <button className="reconstruction-cancel" aria-label="Cancel" title="Cancel reconstruction" onClick={()=>void cancel()}><FiX aria-hidden="true"/></button>}
    <button className="reconstruction-details" aria-label={action} title={action} onClick={()=>{setExpanded(false);details()}}><FiMoreHorizontal aria-hidden="true"/></button>
    {expanded && <div className="reconstruction-popover" id={panelId}>
      <header><strong>Reconstruction</strong><button aria-label="Close reconstruction status" onClick={()=>setExpanded(false)}><FiX/></button></header>
      <ol>{['Upload','Reconstruct','3D model'].map((label,index)=><li key={label} aria-current={index===Math.min(phase,2)?'step':undefined} data-complete={index<phase}>{label}</li>)}</ol>
      <p>{message}</p>{pending && <small>{elapsed}s elapsed</small>}
      <button onClick={()=>{setExpanded(false);details()}}>{action}</button>
      {pending && state.analysisId && <button onClick={()=>void cancel()}>Cancel reconstruction</button>}
    </div>}
    {error && <p className="reconstruction-cancel-error" role="alert">{error}</p>}
  </section>
}
