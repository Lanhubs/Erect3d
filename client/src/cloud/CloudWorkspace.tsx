import { useState } from 'react'
import { Workspace } from '../app/Workspace'
import { useProject } from '../state/project'
import { useCloudProject } from './useCloudProject'
import { useAccount, type User } from './account'
import { CloudTools } from './CloudTools'
import { ConflictReview } from './ConflictReview'
import { downloadDocument } from './changes'
import { localCopy } from './projectActions'
const labels = { saved: 'Synced', pending: 'Device draft queued', syncing: 'Syncing…', offline: 'Offline · draft kept on device', conflict: 'Revision conflict · draft kept', blocked: 'Sync needs attention · draft kept' }
export function CloudWorkspace({ user, projectId, navigate }: { user: User; projectId: string; navigate: (path: string) => void }) {
  const session = useCloudProject(user, projectId), project = useProject(state => state.project)
  const [tools, setTools] = useState(false), [conflict, setConflict] = useState(false), [error, setError] = useState(''), [copying, setCopying] = useState(false)
  const generation = useAccount(state => state.generation)
  const back = async () => {
    try { useProject.getState().finishPreview(); await session.engine?.flush(); navigate('/cloud') }
    catch (error) { setError((error as Error).message) }
  }
  if (!project || !session.record) return <main className="cloud-page"><button onClick={() => navigate('/cloud')}>Cloud projects</button><p role={session.error ? 'alert' : 'status'}>{session.error || 'Opening private project…'}</p><button onClick={() => window.location.reload()}>Retry</button></main>
  return <div className="cloud-workspace" key={generation}>
    <div className="cloud-bar"><span role="status">{session.secondary ? 'Read only · editing in another tab' : labels[session.state]} · r{session.record.base.revision} · {session.record.base.role}</span>
      {session.engine && <button onClick={() => void session.engine!.refresh().catch(error => setError(error.message))}>Retry sync</button>}
      {session.record.conflict && session.engine && <button className="primary" onClick={() => setConflict(true)}>Review conflict</button>}
      <button aria-expanded={tools} onClick={() => setTools(value => !value)}>Cloud tools{session.peers.length ? ` · ${session.peers.length} online` : ''}</button>
      <details className="cloud-draft-menu"><summary>Device draft</summary><button onClick={() => downloadDocument(useProject.getState().previewBase || useProject.getState().project!)}>Export JSON</button>
        <button disabled={copying} onClick={async () => { setCopying(true); setError(''); try { const id = await localCopy({ ...session.record!, draft: useProject.getState().previewBase || useProject.getState().project! }); navigate(`/${id}`) } catch (error) { setError((error as Error).message) } finally { setCopying(false) } }}>Save separate local copy</button></details>
      {session.secondary && <button onClick={() => window.location.reload()}>Try editing in this tab</button>}
    </div>
    {(session.error || error) && <div className="cloud-error" role="alert">{error || session.error}</div>}
    <Workspace project={project} back={() => { void back() }} />
    {tools && <CloudTools session={session} close={() => setTools(false)} />}
    {conflict && session.engine && session.record.conflict && <ConflictReview key={session.record.conflict.revision} engine={session.engine} close={() => setConflict(false)} />}
  </div>
}
