import { useEffect,useState } from 'react'
import { Workspace } from '../app/Workspace'
import { useProject } from '../state/project'
import { useCloudProject } from './useCloudProject'
import { useAccount, type User } from './account'
import { CloudTools } from './CloudTools'
import { ConflictReview } from './ConflictReview'
import {WorkspaceDock} from './WorkspaceDock'
import {useReconstruction} from './reconstructionState'
export function CloudWorkspace({ user, projectId, navigate }: { user: User; projectId: string; navigate: (path: string) => void }) {
  const session = useCloudProject(user, projectId), project = useProject(state => state.project)
  const [tools, setTools] = useState(false), [conflict, setConflict] = useState(false), [error, setError] = useState('')
  const [reconstructRequest,setReconstructRequest]=useState(0)
  const reconstruction=useReconstruction(state=>state.current),reconstructing=reconstruction?.projectId===projectId && reconstruction.status==='pending'
  const generation = useAccount(state => state.generation)
  const [offlineReady,setOfflineReady]=useState(false)
  useEffect(()=>{
    let alive=true
    if ('serviceWorker' in navigator) void navigator.serviceWorker.ready.then(()=>{if(alive)setOfflineReady(true)})
    return()=>{alive=false}
  },[])
  const back = async () => {
    try { useProject.getState().finishPreview(); await session.engine?.flush(); navigate('/projects') }
    catch (error) { setError((error as Error).message) }
  }
  if (!project || !session.record) return <main className="cloud-page"><button onClick={() => navigate('/projects')}>Projects</button><p role={session.error ? 'alert' : 'status'}>{session.error || 'Opening project…'}</p><button onClick={() => window.location.reload()}>Retry</button></main>
  return <div className="cloud-workspace" key={generation}>
    <Workspace project={project} back={() => { void back() }} reconstructing={reconstructing}
      statusContent={<WorkspaceDock session={session} projectId={projectId} offlineReady={offlineReady} error={error || session.error}
        onError={setError} reviewConflict={()=>setConflict(true)} toolsOpen={tools}
        toggleTools={()=>{setReconstructRequest(0);setTools(value=>!value)}} showDetails={()=>setTools(true)}/>}
      onBackendAnalysis={()=>{
      const current=useReconstruction.getState().current;if(current?.projectId===projectId && current.status==='pending')return
      useReconstruction.getState().update({projectId,status:'pending',job_status:'queued',startedAt:Date.now(),message:'Preparing your floor plan…'});setReconstructRequest(value=>value+1)
    }} />
    <CloudTools session={session} open={tools} reconstructRequest={reconstructRequest} close={() => {setReconstructRequest(0);setTools(false)}} />
    {conflict && session.engine && session.record.conflict && <ConflictReview key={session.record.conflict.revision} engine={session.engine} close={() => setConflict(false)} />}
  </div>
}
