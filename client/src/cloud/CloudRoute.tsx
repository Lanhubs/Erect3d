import { useEffect } from 'react'
import type { Project } from '../domain/types'
import { cloudEnabled } from './config'
import { refreshAccount, useAccount } from './account'
import { AccountPanel } from './AccountPanel'
import { CloudDashboard } from './CloudDashboard'
import { CloudWorkspace } from './CloudWorkspace'
import './cloud.css'
export function CloudRoute({ route, projects, navigate }: { route: string; projects: Project[]; navigate: (path: string) => void }) {
  const { user, generation } = useAccount()
  useEffect(() => { if (cloudEnabled) void refreshAccount() }, [])
  const projectId = route.startsWith('/cloud/') ? decodeURIComponent(route.slice(7)) : ''
  if (!cloudEnabled) return <main className="cloud-page"><h1>Cloud mode is not enabled on this deployment</h1><button onClick={() => navigate('/projects')}>Local projects</button></main>
  if (user && projectId) return <CloudWorkspace key={`${user.id}:${generation}:${projectId}`} user={user} projectId={projectId} navigate={navigate} />
  return <main className="cloud-page"><header className="cloud-page-header"><a href="/">Erect3D</a><nav><button onClick={() => navigate('/projects')}>Local projects</button><button aria-current="page">Cloud projects</button></nav></header>
    <AccountPanel />{user && <CloudDashboard key={`${user.id}:${generation}`} localProjects={projects} navigate={navigate} />}
  </main>
}
