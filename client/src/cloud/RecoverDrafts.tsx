import { useState } from 'react'
import type { Project } from '../domain/types'
import { listProjects } from '../state/database'
import { createRemote } from './projectActions'
export function RecoverDrafts({userId,open}:{userId:string;open:(id:string)=>void}) {
  const [drafts,setDrafts]=useState<Project[]>([]),[checked,setChecked]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('')
  return <details onToggle={event=>{
    if (event.currentTarget.open && !checked) {setChecked(true);void listProjects().then(setDrafts).catch(error=>setError(error.message))}
  }}><summary>Recover previous device drafts</summary>
    <p>Bring a design saved by an earlier version into your account. The original draft is retained.</p>
    {drafts.map(project=><div className="cloud-inline" key={project.id}><span>{project.name}</span>
      <button disabled={busy} onClick={async()=>{
        setBusy(true);setError('')
        try {open(await createRemote(userId,project,`recover-${project.id}`,true))}catch(error){setError((error as Error).message)}finally{setBusy(false)}
      }}>Recover project</button></div>)}
    {checked && !drafts.length && <p>No previous drafts on this device.</p>}{error && <p role="alert">{error}</p>}
  </details>
}
