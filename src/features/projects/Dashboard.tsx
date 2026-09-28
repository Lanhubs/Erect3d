import { useState } from 'react'
import type { Project } from '../../domain/types'

type Props = {
  projects: Project[]; open: (project: Project) => void
  create: (name: string, sample: boolean, building: string, units: Project['units']) => void
  remove: (id: string) => void
}
export function Dashboard({ projects, open, create, remove }: Props) {
  const [name, setName] = useState('')
  const [building, setBuilding] = useState('')
  const [units, setUnits] = useState<Project['units']>('m')
  return <main className="dashboard">
    <header className="dashboard-head"><div className="brand-mark">E<span>3</span></div>
      <div><strong>ERECT</strong><small>ARCHITECTURAL RECONSTRUCTION</small></div>
    </header>
    <div className="dashboard-main">
      <div className="section-lead"><div className="eyebrow">WORKSPACE</div>
        <h1>Architectural projects</h1><p>Import or draw a floor plan, edit the building, and explore every level in 3D.</p>
      </div>
      <div className="create-row">
        <input aria-label="Project name" placeholder="Project name" value={name}
          onChange={event => setName(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter' && name.trim()) create(name.trim(), false, building, units)
          }} />
        <input aria-label="Building name" placeholder="Building name (optional)" value={building}
          onChange={event => setBuilding(event.target.value)} />
        <select aria-label="Display units" value={units}
          onChange={event => setUnits(event.target.value as Project['units'])}>
          <option value="m">metres</option><option value="cm">centimetres</option><option value="mm">millimetres</option>
        </select>
        <button className="primary" disabled={!name.trim()}
          onClick={() => create(name.trim(), false, building, units)}>Create project</button>
        <button onClick={() => create('Courtyard residence', true, '', 'm')}>Open sample building</button>
      </div>
      <div className="list-head"><span>RECENT PROJECTS</span><span>{projects.length} total</span></div>
      {projects.length === 0 ? <div className="no-projects">No projects yet. Create one or inspect the sample building.</div>
        : <div className="project-list">{projects.toSorted((a, b) => b.modified - a.modified).map(project =>
          <div className="project-row" key={project.id}>
            <div className="project-icon">{project.sources.length ? 'PL' : '3D'}</div>
            <div className="project-info"><strong>{project.name}</strong>
              <span>{project.sources[0]?.name || 'Manual model'} · Updated {new Date(project.modified).toLocaleDateString()}</span>
            </div>
            <button onClick={() => open(project)}>Open</button>
            <button className="quiet" onClick={() => {
              if (confirm(`Delete ${project.name}?`)) remove(project.id)
            }}>Delete</button>
          </div>)}</div>}
      <section className="dashboard-about" aria-label="About Erect 3D">
        <h2>From floor plan to editable 3D building</h2>
        <p>Work from a PNG, JPEG or PDF drawing, or start with a blank plan. Review detected walls, edit doors and windows, and configure rooms, floors, stairs, columns and roofs.</p>
        <h2>Explore the entire building</h2>
        <p>Design multiple levels with real elevations, inspect section and exploded views, then walk through the model in your browser. Projects are stored locally on this device.</p>
      </section>
    </div>
     </main>
}
