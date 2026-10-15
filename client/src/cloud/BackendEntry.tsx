import { useState } from 'react'
import type { Project } from '../domain/types'
import { refreshAccount,useAccount } from './account'
import { createRemote } from './projectActions'
import { saveLocalProject } from '../state/database'
import { cloudEnabled } from './config'
export function BackendEntry({project,local}:{project:Project;local:()=>void}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  const start=async()=>{
    setBusy(true);setError('')
    try {
      await saveLocalProject(project)
      if (!cloudEnabled) throw new Error('Enable the backend workspace on this deployment to reconstruct with AI. Local analysis remains available below.')
      await refreshAccount()
      const user=useAccount.getState().user
      if (!user) {sessionStorage.setItem('erect-backend-copy',project.id);window.location.assign('/projects');return}
      const id=await createRemote(user.id,project,`backend-${project.id}`,true)
      window.location.assign(`/projects/${id}`)
    } catch(error) {setError((error as Error).message)} finally {setBusy(false)}
  }
  return <section className="reconstruction-flow"><div><strong>BACKEND RECONSTRUCTION</strong><span>Read the source with AI and build a validated editable floor. Your local project is preserved as a separate copy; source upload requires cloud consent.</span></div>
    <button className="primary" disabled={busy} onClick={()=>void start()}>{busy?'Opening backend workspace…':'Reconstruct with backend AI'}</button>
    <button disabled={busy} onClick={local}>Use local analysis instead</button>{error && <p role="alert">{error}</p>}</section>
}
