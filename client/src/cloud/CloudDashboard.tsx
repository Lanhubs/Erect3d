import { useCallback, useEffect, useRef, useState } from 'react'
import { Dashboard, type DashboardProject } from '../features/projects/Dashboard'
import type { ArchitecturalSample } from '../domain/sampleLibrary'
import { fixtureProject } from '../domain/fixture'
import { useAccount } from './account'
import { AccountPanel } from './AccountPanel'
import { createRemote, remoteProjects, createFromTemplate } from './projectActions'
import { api } from './api'
import { getTask } from './cache'
import { RecoverDrafts } from './RecoverDrafts'
import { documentChanges } from '../../../api/client'
import { useProject } from '../state/project'
import { loadProjectPreview } from './projectPreviews'
import { FiRefreshCw } from 'react-icons/fi'
export function CloudDashboard({ navigate }: { navigate: (path: string) => void }) {
  const user = useAccount((state) => state.user)!
  const [items, setItems] = useState<DashboardProject[]>([]),
    [samples, setSamples] = useState<ArchitecturalSample[]>([])
  const [error, setError] = useState(''),
    [samplesError, setSamplesError] = useState(''),
    [busy, setBusy] = useState(false),
    [offline, setOffline] = useState(false)
  const [retryCreate, setRetryCreate] = useState(false)
  const [loading, setLoading] = useState(true)
  const templatesRequested = useRef(false),
    templatesBusy = useRef(false)
  const loadTemplates = async (force = false) => {
    if (templatesBusy.current || (templatesRequested.current && !force)) return
    templatesRequested.current = true
    templatesBusy.current = true
    try {
      setSamples((await api.request<{ items: ArchitecturalSample[] }>('/templates')).items)
      setSamplesError('')
    } catch {
      setSamplesError(
        'Templates require a connection to the server. Open an existing project to keep working offline.',
      )
      templatesRequested.current = false
    } finally {
      templatesBusy.current = false
    }
  }
  const loadPreview = useCallback(
    (project: DashboardProject) => loadProjectPreview(user.id, project.id, project.revision),
    [user.id],
  )
  const refresh = async () => {
    setLoading(true)
    try {
      const result = await remoteProjects(user.id)
      setOffline(result.cached)
      setItems(
        result.projects.map((project) => {
          const record = result.records.find((record) => record.base.projectId === project.id)
          return {
            ...project,
            modified: record?.draft.modified || Date.parse(project.modified_at || '') || Date.now(),
            sources: record?.draft.sources || [],
            offline: result.cached,
            pending: Boolean(
              record &&
              (record.pending ||
                record.conflict ||
                documentChanges(record.base.document, record.draft).length),
            ),
          }
        }),
      )
      const task = await getTask<{ complete?: boolean }>(`${user.id}/create/new`)
      setRetryCreate(Boolean(task && !task.complete))
    } catch (error) {
      setError((error as Error).message)
    } finally {
      setLoading(false)
    }
    if (templatesRequested.current) void loadTemplates(true)
  }
  useEffect(() => {
    void refresh()
    const online = () => void refresh()
    window.addEventListener('online', online)
    return () => window.removeEventListener('online', online)
  }, [user.id])
  const run = async (action: () => Promise<string>) => {
    setBusy(true)
    setError('')
    try {
      navigate(`/projects/${await action()}`)
    } catch (error) {
      setError((error as Error).message)
      await refresh()
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dashboard
      projects={items}
      samples={samples}
      account={<AccountPanel />}
      busy={busy}
      createBlocked={offline}
      samplesError={samplesError}
      createError={error}
      loadTemplates={() => void loadTemplates()}
      loadPreview={loadPreview}
      loading={loading}
      open={(project) => navigate(`/projects/${project.id}`)}
      openSample={(sample, duplicate) =>
        void run(async () => {
          const id = await createFromTemplate(user.id, sample.id, duplicate)
          if (sample.preferredView) useProject.getState().setView(sample.preferredView)
          return id
        })
      }
      create={(name, _sample, building, units) =>
        void run(() => {
          const project = fixtureProject(name)
          project.units = units
          if (building.trim()) project.buildings[0].name = building.trim()
          Object.assign(project.buildings[0].levels[0], {
            walls: [],
            doors: [],
            windows: [],
            rooms: [],
            slabs: [],
          })
          return createRemote(user.id, project, 'new')
        })
      }
      remove={async (id) => {
        setBusy(true)
        try {
          await api.request(`/projects/${id}`, 'DELETE')
          await refresh()
        } finally {
          setBusy(false)
        }
      }}
      notice={
        <>
          {offline && (
            <p role="status">
              Offline · Open a previously opened project. Your edits will sync automatically when the
              connection returns.
            </p>
          )}
          {error && <p role="alert">{error}</p>}
          <div className="project-notice-actions">
            {retryCreate && (
              <button onClick={() => void run(() => createRemote(user.id, fixtureProject('Project'), 'new'))}>
                Retry pending project creation
              </button>
            )}
            <button
              disabled={busy || loading}
              onClick={() => {
                setError('')
                void refresh()
              }}
            >
              <FiRefreshCw aria-hidden="true" />
              {loading ? 'Refreshing…' : 'Refresh projects'}
            </button>
          </div>
          <RecoverDrafts userId={user.id} open={(id) => navigate(`/projects/${id}`)} />
        </>
      }
    />
  )
}
