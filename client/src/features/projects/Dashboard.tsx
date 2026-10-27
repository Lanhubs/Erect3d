import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { dismissMenu } from '../../app/useOverlay'
import { confirmAction } from '../../app/ConfirmationHost'
import type { Project } from '../../domain/types'
import type { ArchitecturalSample } from '../../domain/sampleLibrary'
import type { PlanPreview } from '../../domain/planPreview'
import { useRenderPreference } from '../../state/renderPreference'
import { NewProjectDialog } from './NewProjectDialog'
import { ProjectPreview } from './ProjectPreview'
import { SampleLibrary } from './SampleLibrary'
import './projectBrowser.css'
export type DashboardProject = Pick<Project, 'id' | 'name' | 'modified' | 'sources'> & {
  pending?: boolean
  revision?: number
  offline?: boolean
}
type Props = {
  projects: DashboardProject[]
  open: (project: DashboardProject) => void
  samples: ArchitecturalSample[]
  openSample: (sample: ArchitecturalSample, duplicate: boolean) => void
  create: (name: string, sample: boolean, building: string, units: Project['units']) => void
  remove: (id: string) => Promise<void>
  account?: ReactNode
  notice?: ReactNode
  busy?: boolean
  createBlocked?: boolean
  samplesError?: string
  createError?: string
  loading?: boolean
  loadTemplates?: () => void
  loadPreview?: (project: DashboardProject) => Promise<PlanPreview>
}
export function visibleProjects(projects: DashboardProject[], query: string, sort: string) {
  return projects
    .filter((p) => p.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    .toSorted(
      (a, b) =>
        (sort === 'name'
          ? a.name.localeCompare(b.name)
          : sort === 'oldest'
            ? a.modified - b.modified
            : b.modified - a.modified) || a.id.localeCompare(b.id),
    )
}
export function Dashboard({
  projects,
  samples,
  open,
  openSample,
  create,
  remove,
  account,
  notice,
  busy,
  createBlocked,
  samplesError,
  loadTemplates,
  loadPreview,
  createError,
  loading = false,
}: Props) {
  const [tab, setTab] = useState<'projects' | 'templates'>('projects'),
    [query, setQuery] = useState(''),
    [sort, setSort] = useState('recent'),
    [creating, setCreating] = useState(false)
  const { renderer, setRenderer } = useRenderPreference(),
    shown = useMemo(() => visibleProjects(projects, query, sort), [projects, query, sort])
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      dismissMenu(event)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])
  const chooseTab = (next: typeof tab) => {
    setTab(next)
    if (next === 'templates') loadTemplates?.()
  }
  return (
    <main className="dashboard project-browser">
      <header className="dashboard-head">
        <div className="brand-mark">
          <img src="/favicon.svg" alt="Erect3D logo" />
        </div>
        <div>
          <strong>ERECT</strong>
          <small>ARCHITECTURAL RECONSTRUCTION</small>
        </div>
        {account}
      </header>
      <div className="dashboard-main">
        <header className="project-page-heading">
          <div>
            <div className="eyebrow">WORKSPACE</div>
            <h1>Your projects</h1>
            <p>Continue a building or start from a template.</p>
          </div>
          <button className="primary" disabled={busy || createBlocked} onClick={() => setCreating(true)}>
            + New project
          </button>
        </header>
        <div className="project-browser-nav">
          <nav aria-label="Project library">
            <button aria-pressed={tab === 'projects'} onClick={() => chooseTab('projects')}>
              Projects <span>{projects.length}</span>
            </button>
            <button aria-pressed={tab === 'templates'} onClick={() => chooseTab('templates')}>
              Templates
            </button>
          </nav>
          <details className="graphics-preference">
            <summary>Graphics</summary>
            <label>
              3D renderer
              <select
                aria-label="3D renderer"
                value={renderer}
                onChange={(e) => setRenderer(e.target.value as typeof renderer)}
              >
                <option value="auto">WebGPU preferred</option>
                <option value="webgl">Compatibility renderer</option>
              </select>
            </label>
            <p>Applies before opening 3D. Rendering quality stays fixed while you navigate.</p>
          </details>
        </div>
        <div className="project-notices">{notice}</div>
        {tab === 'projects' ? (
          <section aria-label="Projects">
            <div className="project-filters">
              <input
                type="search"
                aria-label="Search projects"
                placeholder="Search projects…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <select aria-label="Sort projects" value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="recent">Recently updated</option>
                <option value="oldest">Oldest updated</option>
                <option value="name">Name</option>
              </select>
            </div>
            <div className="project-result-count" role="status">
              {loading
                ? 'Loading projects…'
                : `${shown.length} ${shown.length === 1 ? 'project' : 'projects'}${query ? ' found' : ''}`}
            </div>
            {shown.length ? (
              <div className="project-results grid">
                {shown.map((project) => (
                  <article className="project-item" key={project.id}>
                    <ProjectPreview project={project} load={loadPreview} />
                    <div className="project-item-info">
                      <button className="project-name" disabled={busy} onClick={() => open(project)}>
                        {project.name}
                      </button>
                      <span>{project.sources[0]?.name || 'Building model'}</span>
                      <time dateTime={new Date(project.modified).toISOString()}>
                        Updated {new Date(project.modified).toLocaleDateString()}
                      </time>
                    </div>
                    <span className={`project-sync ${project.pending ? 'pending' : ''}`}>
                      {project.pending
                        ? 'Changes waiting to sync'
                        : project.offline
                          ? 'Available offline'
                          : 'Saved'}
                    </span>
                    <div className="project-item-actions">
                      <button disabled={busy} onClick={() => open(project)}>
                        Open
                      </button>
                      <button
                        className="project-delete"
                        disabled={busy}
                        onClick={() =>
                          void confirmAction({
                            title: 'Delete project?',
                            item: project.name,
                            message:
                              'This removes the project and its shared access. This action cannot be undone.',
                            label: 'Delete project',
                            destructive: true,
                            onConfirm: () => remove(project.id),
                          })
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              !loading && (
                <div className="project-empty">
                  <h2>{query ? 'No matching projects' : 'Your next building starts here'}</h2>
                  <p>
                    {query
                      ? 'Try a different project name.'
                      : 'Create a project or explore an editable template.'}
                  </p>
                  {!query && <button onClick={() => chooseTab('templates')}>Browse templates</button>}
                </div>
              )
            )}
          </section>
        ) : (
          <SampleLibrary
            samples={samples}
            openSample={openSample}
            busy={busy}
            createBlocked={createBlocked}
            samplesError={samplesError}
          />
        )}
      </div>
      {creating && (
        <NewProjectDialog
          close={() => setCreating(false)}
          create={create}
          busy={busy}
          blocked={createBlocked}
          error={createError}
        />
      )}
    </main>
  )
}
