import {LoadingState} from '../app/LoadingState'
import { useEffect,useState } from 'react'
import { Workspace } from '../app/Workspace'
import { useProject } from '../state/project'
import { useCloudProject } from './useCloudProject'
import { useAccount, type User } from './account'
import { CloudTools } from './CloudTools'
import { ConflictReview } from './ConflictReview'
import {WorkspaceDock} from './WorkspaceDock'
import {useReconstruction} from './reconstructionState'
import {reconstructionContext,sameReconstructionSource} from './reconstructionContext'
import {api} from './api'
import {useAssistant} from './useAssistant'
import {AssistantDialog,AssistantPreviewBar} from './AssistantDialog'
export function CloudWorkspace({ user, projectId, navigate }: { user: User; projectId: string; navigate: (path: string) => void }) {
  const session = useCloudProject(user, projectId), project = useProject(state => state.project)
  const [toolsTab,setToolsTab]=useState<'source'|'people'>('source')
  const [tools, setTools] = useState(false), [conflict, setConflict] = useState(false), [error, setError] = useState('')
  const [chat,setChat]=useState(false),[preview,setPreview]=useState(false),[proposed,setProposed]=useState(true)
  const assistant=useAssistant(user.id,projectId,session,chat)
  const editLocked=useProject(state=>state.editLocked)
  const previewDocument=preview&&!assistant.stale&&assistant.thread.run?.status==='ready'?assistant.thread.run.proposal?.document:undefined
  useEffect(()=>{if(preview&&!previewDocument)setPreview(false)},[preview,previewDocument])
  const [request,setRequest]=useState({token:0,projectId:'',levelId:'',sourceId:''})
  const activeId=useProject(state=>state.activeLevelId),context=project?reconstructionContext(project,activeId):undefined
  const reconstructRequest=sameReconstructionSource(context,request)?request.token:0
  const reconstruction=useReconstruction(state=>state.current),reconstructing=sameReconstructionSource(reconstruction,context) && reconstruction?.status==='pending'
  useEffect(()=>{
    if(!context || !reconstruction || sameReconstructionSource(reconstruction,context))return
    const floor=project?.buildings.flatMap(building=>building.levels).find(level=>level.id===reconstruction.levelId)
    if(project?.id===reconstruction.projectId && floor?.sourceId!==reconstruction.sourceId && reconstruction.status==='pending' && reconstruction.analysisId) {
      void api.request(`/analysis/${reconstruction.analysisId}/cancel`,'POST').catch(()=>{})
    }
    if(useReconstruction.getState().current===reconstruction)useReconstruction.getState().clear()
  },[context?.projectId,context?.levelId,context?.sourceId,reconstruction])
  const resetRequest=()=>setRequest(previous=>({...previous,token:0}))
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
  if (!project || !session.record) return <main className="cloud-page"><button onClick={() => navigate('/projects')}>Projects</button>{session.error?<><p role="alert">{session.error}</p><button onClick={()=>window.location.reload()}>Retry</button></>:<LoadingState label="Opening your project" detail="Preparing the saved building and workspace."/>}</main>
  return <div className="cloud-workspace" key={generation}>
    <Workspace project={previewDocument&&proposed?previewDocument:project} back={() => { void back() }} reconstructing={reconstructing}
      collaborate={()=>{setToolsTab('people');setTools(true)}} assistant={()=>setChat(value=>!value)} assistantOpen={chat} previewing={!!previewDocument||editLocked}
      previewControls={previewDocument&&<AssistantPreviewBar assistant={assistant} proposed={proposed} toggle={setProposed} close={()=>setPreview(false)} chat={()=>setChat(true)}/>}
      statusContent={<WorkspaceDock session={session} projectId={projectId} offlineReady={offlineReady} error={error || session.error}
        onError={setError} reviewConflict={()=>setConflict(true)} toolsOpen={tools}
        toggleTools={()=>{setToolsTab('source');resetRequest();setTools(value=>!value)}} showDetails={()=>{setToolsTab('source');setTools(true)}}/>}
      onBackendAnalysis={()=>{
      if(!context?.sourceId)return
      const current=useReconstruction.getState().current;if(sameReconstructionSource(current,context) && current?.status==='pending')return
      useReconstruction.getState().update({...context,status:'pending',job_status:'queued',startedAt:Date.now(),message:'Preparing your floor plan…'});setRequest(previous=>({...context,token:previous.token+1}))
    }} />
    <CloudTools initialTab={toolsTab} session={session} open={tools} reconstructRequest={reconstructRequest} close={() => {resetRequest();setTools(false)}} />
    <AssistantDialog assistant={assistant} open={chat} close={()=>setChat(false)} preview={()=>{useProject.getState().setTool('select');setChat(false);setProposed(true);setPreview(true)}}/>
    {conflict && session.engine && session.record.conflict && <ConflictReview key={session.record.conflict.revision} engine={session.engine} close={() => setConflict(false)} />}
  </div>
}
