import { useCallback, useEffect, useMemo, useState } from 'react'
import { Dashboard } from './features/projects/Dashboard'
import { Workspace } from './app/Workspace'
import { fixtureProject } from './domain/fixture'
import type { Project } from './domain/types'
import { levelOf } from './domain/types'
import { deleteProject, listProjects, loadProject, saveProject } from './state/database'
import { useProject } from './state/project'
import { LandingPage } from './features/landing/LandingPage'
import './App.css'

const normalizePath = (input: string) => {
  const next = (input || '/').trim()
  if (!next || next === '/') return '/'
  const withoutTrailing = next.endsWith('/') && next.length > 1 ? next.slice(0, -1) : next
  return withoutTrailing || '/'
}

const projectIdFromPath = (pathname: string) => {
  const normalized = normalizePath(pathname)
  if (normalized === '/' || normalized === '/projects') return null
  return normalized.replace(/^\//, '')
}

function App() {
  const [projects, setProjects] = useState<Project[]>([])
  const [error, setError] = useState('')
  const [route, setRoute] = useState<string>(() => normalizePath(window.location.pathname))
  const project = useProject(s => s.project), setProject = useProject(s => s.setProject)
  const projectId = useMemo(() => projectIdFromPath(route), [route])

  const navigateTo = useCallback((nextPath: string) => {
    const normalized = normalizePath(nextPath)
    if (window.location.pathname !== normalized) {
      window.history.pushState({}, '', normalized)
    }
    setRoute(normalized)
  }, [])

  useEffect(() => {
    const onLocationChange = () => setRoute(normalizePath(window.location.pathname))
    window.addEventListener('popstate', onLocationChange)
    return () => window.removeEventListener('popstate', onLocationChange)
  }, [])

  useEffect(() => { listProjects().then(setProjects).catch(cause => setError(`Could not open local projects: ${(cause as Error).message}`)) }, [])

  const openProjectById = useCallback(async (selectedId: string) => {
    try {
      const latest = await loadProject(selectedId)
      if (!latest) {
        navigateTo('/projects')
        return
      }
      setProjects(items => items.map(item => item.id === latest.id ? latest : item))
      setProject(latest)
    } catch (cause) { setError(`Could not open project: ${(cause as Error).message}`) }
  }, [navigateTo, setProject])

  useEffect(() => {
    if (route === '/' || route === '/projects') {
      if (project) setProject(null)
      return
    }

    const selectedId = projectIdFromPath(route)
    if (!selectedId) return
    if (project?.id === selectedId) return
    void openProjectById(selectedId)
  }, [project, projectId, route, openProjectById, setProject])

  const create = async (name: string, sample: boolean, building: string, units: Project['units']) => {
    const next = fixtureProject(name)
    next.units = units
    if (building.trim()) next.buildings[0].name = building.trim()
    if (!sample) Object.assign(levelOf(next), { walls: [], doors: [], windows: [], rooms: [] })
    await saveProject(next)
    setProjects(items => [...items, next])
    setProject(next)
    navigateTo(`/${next.id}`)
  }
  const remove = async (id: string) => {
    const target = projects.find(item => item.id === id)
    if (!target) return
    await deleteProject(target)
    setProjects(items => items.filter(item => item.id !== id))
  }
  const open = async (selected: Project) => {
    try {
      const latest = await loadProject(selected.id)
      if (!latest) throw new Error('This project is no longer stored locally.')
      setProjects(items => items.map(item => item.id === latest.id ? latest : item))
      setProject(latest)
      navigateTo(`/${latest.id}`)
    } catch (cause) { setError(`Could not open project: ${(cause as Error).message}`) }
  }
  const openWorkspace = async () => {
    const newest = [...projects].sort((a, b) => b.modified - a.modified)[0]
    if (!newest) {
      navigateTo('/projects')
      return
    }
    await open(newest)
  }
  const back = async () => {
    try {
      if (project && useProject.getState().dirty) await saveProject(project)
      setProjects(await listProjects())
      setProject(null)
      navigateTo('/projects')
    } catch (cause) { setError(`Could not save project: ${(cause as Error).message}`) }
  }

  if (error) return <div className="fatal-error">{error}</div>
  if (project && route === `/${project.id}`) return <Workspace project={project} back={back} />
  if (route === '/') return <LandingPage projects={projects} onStartDesigning={() => navigateTo('/projects')} onOpenWorkspace={openWorkspace} />
  if (route === '/projects') return <Dashboard projects={projects} open={open} create={create} remove={remove} />
  if (projectId) return <div className="fatal-error">Loading project…</div>
  return <Dashboard projects={projects} open={open} create={create} remove={remove} />
}
export default App
