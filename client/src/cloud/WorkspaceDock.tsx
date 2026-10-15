import {useEffect,useRef} from 'react'
import {FiCheckCircle,FiCloud,FiAlertCircle,FiSliders,FiWifiOff} from 'react-icons/fi'
import type {CloudSession} from './useCloudProject'
import {downloadDocument} from './changes'
import {useProject} from '../state/project'
import {ReconstructionProgress} from './ReconstructionProgress'
import {activeLevel} from '../domain/types'
import './workspaceDock.css'
const labels={saved:'Synced',pending:'Device draft queued',syncing:'Syncing…',offline:'Offline · draft kept on device',conflict:'Revision conflict · draft kept',blocked:'Sync needs attention · draft kept'}
type Props={session:CloudSession;projectId:string;offlineReady:boolean;error:string;onError:(error:string)=>void;
  reviewConflict:()=>void;toolsOpen:boolean;toggleTools:()=>void;showDetails:()=>void}
export function WorkspaceDock({session,projectId,offlineReady,error,onError,reviewConflict,toolsOpen,toggleTools,showDetails}:Props) {
  const menu=useRef<HTMLDetailsElement>(null),record=session.record!
  const project=useProject(state=>state.project),levelId=useProject(state=>state.activeLevelId)
  const level=project?activeLevel(project,levelId):undefined
  const warning=Boolean(error || session.secondary || ['conflict','blocked','offline'].includes(session.state))
  const label=session.secondary?'Read only · editing in another tab':error?'Sync needs attention':labels[session.state]
  const Icon=warning?session.state==='offline'?FiWifiOff:FiAlertCircle:session.state==='saved'?FiCheckCircle:FiCloud
  useEffect(()=>{
    const dismiss=(event:Event)=>{if(menu.current && (event instanceof KeyboardEvent?event.key==='Escape':!menu.current.contains(event.target as Node)))menu.current.open=false}
    document.addEventListener('pointerdown',dismiss);document.addEventListener('keydown',dismiss)
    return()=>{document.removeEventListener('pointerdown',dismiss);document.removeEventListener('keydown',dismiss)}
  },[])
  const close=()=>{if(menu.current)menu.current.open=false}
  return <div className="cloud-dock" aria-label="Project status and actions">
    <ReconstructionProgress projectId={projectId} details={showDetails}/>
    <details ref={menu} className="cloud-session-menu">
      <summary className={`cloud-sync-trigger${warning?' needs-attention':''}`} aria-label={`Project sync: ${label} · r${record.base.revision} · ${record.base.role}`}
        title={`${label} · r${record.base.revision} · ${record.base.role}${offlineReady?' · Offline ready':''}`}>
        <Icon aria-hidden="true"/><span role="status">{label}<span className="cloud-revision"> · r{record.base.revision}</span></span>
        {offlineReady && <i className="cloud-offline-ready" aria-label="Offline ready" title="Offline ready"/>}
      </summary>
      <div className="cloud-status-panel"><strong>Project sync</strong><p>{label} · r{record.base.revision} · {record.base.role}</p>
        {level && project && <p>{level.name} · {level.walls.length} walls · {level.doors.length} doors · {level.windows.length} windows · {project.units.toUpperCase()} · 1:1 MODEL</p>}
        {offlineReady && <p title="The app and this opened project can be reopened without a connection.">Offline ready · this opened project can be reopened and edited without a connection.</p>}
        {error && <p className="cloud-error">{error}</p>}
        {session.engine && <button onClick={()=>void session.engine!.refresh().then(close).catch(error=>onError(error.message))}>Retry sync</button>}
        {record.conflict && session.engine && <button className="primary" onClick={()=>{close();reviewConflict()}}>Review conflict</button>}
        <details className="cloud-draft-menu"><summary>Device draft</summary><button onClick={()=>downloadDocument(useProject.getState().previewBase || useProject.getState().project!)}>Export JSON</button></details>
        {session.secondary && <button onClick={()=>window.location.reload()}>Try editing in this tab</button>}
      </div>
    </details>
    <button className="cloud-tools-trigger" aria-expanded={toolsOpen} onClick={toggleTools} title="Project tools"
      aria-label={`Project tools${session.peers.length?` · ${session.peers.length} online`:''}`}>
      <FiSliders aria-hidden="true"/><span>Project tools{session.peers.length?` · ${session.peers.length} online`:''}</span>
    </button>
    {error && <span className="cloud-accessible-alert" role="alert">{error}</span>}
  </div>
}
