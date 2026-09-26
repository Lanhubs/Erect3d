import { useEffect, useState } from 'react'
import { Dashboard } from './features/projects/Dashboard'
import { Workspace } from './app/Workspace'
import { fixtureProject } from './domain/fixture'
import type { Project } from './domain/types'
import { levelOf } from './domain/types'
import { deleteProject, listProjects, loadProject, saveProject } from './state/database'
import { useProject } from './state/project'
import './App.css'

function App() {
  const [projects, setProjects] = useState<Project[]>([])
  const [error, setError] = useState('')
  const project = useProject(s => s.project), setProject = useProject(s => s.setProject)
  useEffect(() => { listProjects().then(setProjects).catch(cause => setError(`Could not open local projects: ${(cause as Error).message}`)) }, [])
  const create = async (name: string, sample: boolean, building: string, units: Project['units']) => {
    const next = fixtureProject(name)
    next.units = units
    if (building.trim()) next.buildings[0].name = building.trim()
    if (!sample) Object.assign(levelOf(next), { walls: [], doors: [], windows: [], rooms: [] })
    await saveProject(next)
    setProjects(items => [...items, next]); setProject(next)
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
    } catch (cause) { setError(`Could not open project: ${(cause as Error).message}`) }
  }
  const back = async () => {
    try {
      if (project && useProject.getState().dirty) await saveProject(project)
      setProjects(await listProjects())
      setProject(null)
    } catch (cause) { setError(`Could not save project: ${(cause as Error).message}`) }
  }
  return error ? <div className="fatal-error">{error}</div> : project ? <Workspace project={project} back={back} /> : <Dashboard projects={projects} open={open} create={create} remove={remove} />
}
export default App
