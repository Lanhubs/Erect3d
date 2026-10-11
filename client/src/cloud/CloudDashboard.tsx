import { useEffect, useState } from 'react'
import type { Project } from '../domain/types'
import { fixtureProject } from '../domain/fixture'
import { useAccount } from './account'
import { createRemote, remoteProjects } from './projectActions'
import { getTask } from './cache'
export function CloudDashboard({ localProjects, navigate }: { localProjects: Project[]; navigate: (path: string) => void }) {
  const user = useAccount(state => state.user)!
  const [items, setItems] = useState<{ id: string; name: string; revision: number; pending?: boolean }[]>([])
  const [name, setName] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [cached, setCached] = useState(false)
  const [retryCreate, setRetryCreate] = useState(false), [localId, setLocalId] = useState('')
  const refresh = async () => {
    try {
      const result = await remoteProjects(user.id); setCached(result.cached)
      setItems(result.projects.map(project => ({ ...project, pending: result.records.some(record => record.base.projectId === project.id && (record.pending || record.conflict || JSON.stringify(record.draft) !== JSON.stringify(record.base.document))) })))
      const task = await getTask<{ complete?: boolean }>(`${user.id}/create/new`); setRetryCreate(Boolean(task && !task.complete))
    } catch (error) { setError((error as Error).message) }
  }
  useEffect(() => { void refresh() }, [user.id]) // Account changes remount this panel.
  const run = async (action: () => Promise<string>) => {
    setBusy(true); setError('')
    try { navigate(`/cloud/${await action()}`) } catch (error) { setError((error as Error).message); await refresh() } finally { setBusy(false) }
  }
  return <section className="cloud-projects">
    <h1>Cloud projects</h1><p>Private account workspace · edits queue on this device when offline.</p>
    <div className="cloud-inline">
      <input aria-label="Cloud project name" placeholder="Project name" value={name} onChange={e => setName(e.target.value)} disabled={busy || retryCreate} />
      <button className="primary" disabled={busy || !retryCreate && !name.trim()} onClick={() => void run(() => {
        const project = fixtureProject(name.trim() || 'Cloud project'); const level = project.buildings[0].levels[0]
        Object.assign(level, { walls: [], doors: [], windows: [], rooms: [], slabs: [] })
        return createRemote(user.id, project, 'new')
      })}>{retryCreate ? 'Retry pending creation' : 'Create cloud project'}</button>
      <button disabled={busy} onClick={() => { setError(''); void refresh() }}>Refresh</button>
    </div>
    <details><summary>Copy a local project to cloud</summary>
      <p>This creates a separate cloud model. Its plan files are uploaded only when you choose “Upload plan privately” inside the project.</p>
      <div className="cloud-inline"><select aria-label="Local project to copy" value={localId} onChange={e => setLocalId(e.target.value)}>
        <option value="">Choose local project</option>{localProjects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
      </select><button disabled={busy || !localId} onClick={() => void run(() => createRemote(user.id, localProjects.find(project => project.id === localId)!, `local-${localId}`, true))}>Copy to cloud</button></div>
    </details>
    {cached && <p role="status">Offline: showing projects cached for this account on this device.</p>}
    {error && <p role="alert" className="error">{error}</p>}
    <div className="project-list">{items.map(project => <div className="project-row" key={project.id}>
      <div className="project-info"><strong>{project.name}</strong><span>Revision {project.revision}{project.pending ? ' · Device draft pending' : ''}</span></div>
      <button disabled={busy} onClick={() => navigate(`/cloud/${project.id}`)}>Open cloud project</button>
    </div>)}</div>{!items.length && <p>No cloud projects yet.</p>}
  </section>
}
