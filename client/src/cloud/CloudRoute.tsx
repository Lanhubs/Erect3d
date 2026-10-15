import { useEffect,useState } from 'react'
import { refreshAccount,useAccount } from './account'
import { AccountPanel } from './AccountPanel'
import { CloudDashboard } from './CloudDashboard'
import { CloudWorkspace } from './CloudWorkspace'
import { loadProject } from '../state/database'
import { createRemote } from './projectActions'
import './cloud.css'
export function CloudRoute({route,navigate}:{route:string;navigate:(path:string)=>void}) {
  const {user,generation}=useAccount(),[error,setError]=useState(''),[recovering,setRecovering]=useState(false)
  const projectId=/^\/(?:projects|cloud)\/(.+)$/.exec(route)?.[1]
  const legacyId=!projectId && !['/projects','/cloud'].includes(route)?route.slice(1):''
  useEffect(()=>{void refreshAccount()},[])
  useEffect(()=>{
    const online=()=>void refreshAccount();window.addEventListener('online',online)
    return()=>window.removeEventListener('online',online)
  },[])
  useEffect(()=>{
    const id=legacyId || sessionStorage.getItem('erect-backend-copy')
    if (!user || projectId || !id) return
    let alive=true;setRecovering(true)
    loadProject(id).then(async project=>{
      if (!project) throw new Error('This older draft is unavailable on this device. Open Projects to choose a saved project.')
      if (!alive) return
      const remote=await createRemote(user.id,project,`recover-${id}`,true)
      if (alive) {sessionStorage.removeItem('erect-backend-copy');navigate(`/projects/${remote}`)}
    }).catch(error=>{if(alive)setError(error.message)}).finally(()=>{if(alive)setRecovering(false)})
    return()=>{alive=false}
  },[user?.id,projectId,legacyId])
  if (user && projectId) return <CloudWorkspace key={`${user.id}:${generation}:${projectId}`} user={user} projectId={decodeURIComponent(projectId)} navigate={navigate}/>
  if (user && !recovering && !legacyId && !sessionStorage.getItem('erect-backend-copy')) return <CloudDashboard key={`${user.id}:${generation}`} navigate={navigate}/>
  return <main className="cloud-page"><header className="cloud-page-header"><a href="/">Erect3D</a><h1>Projects</h1></header>
    <AccountPanel/>{recovering && <p role="status">Recovering your saved draft into your account…</p>}
    {error && <p role="alert">{error}</p>}
    {(error || legacyId) && <button onClick={()=>{sessionStorage.removeItem('erect-backend-copy');navigate('/projects')}}>Back to projects</button>}
  </main>
}
