import { useMemo, useState } from 'react'
import type { Project } from '../../domain/types'
import { createSampleLibrary, type ArchitecturalSample, type SampleCategory } from '../../domain/sampleLibrary'
import { wallBoundsPoints, wallSubpath } from '../../geometry/math'

type Props = {
  projects: Project[]; open: (project: Project) => void
  openSample: (project: Project, duplicate: boolean) => void
  create: (name: string, sample: boolean, building: string, units: Project['units']) => void
  remove: (id: string) => void
}
const categories: SampleCategory[] = ['Residential', 'Commercial', 'Public', 'Public / Sports']

function SamplePlan({ sample }: { sample: ArchitecturalSample }) {
  const level = sample.project.buildings[0].levels[0]
  const points = wallBoundsPoints(level.walls)
  const minX = Math.min(...points.map(point => point.x)), maxX = Math.max(...points.map(point => point.x))
  const minZ = Math.min(...points.map(point => point.z)), maxZ = Math.max(...points.map(point => point.z))
  const pad = Math.max(maxX - minX, maxZ - minZ) * .09
  const width = Math.max(1, maxX - minX), height = Math.max(1, maxZ - minZ)
  return <svg className="sample-plan-preview" role="img" aria-label={`${sample.title} ground-floor plan`}
    viewBox={`${minX - pad} ${minZ - pad} ${width + pad * 2} ${height + pad * 2}`}>
    <rect x={minX - pad} y={minZ - pad} width={width + pad * 2} height={height + pad * 2} fill="#f3f4ef" />
    {level.rooms.map(room => <polygon key={room.id} points={room.polygon.map(point => `${point.x},${point.z}`).join(' ')}
      fill={room.category === 'atrium' || room.category === 'field' ? '#dfe8e6' : '#e9e5d9'} stroke="#bcc4bb" strokeWidth={Math.max(.04, width * .002)} />)}
    {(level.slabs || []).flatMap(slab => slab.openings).map(opening => <polygon key={opening.id}
      points={opening.polygon.map(point => `${point.x},${point.z}`).join(' ')} fill="#f3f4ef" stroke="#7d918e"
      strokeDasharray={`${width * .008} ${width * .005}`} strokeWidth={Math.max(.04, width * .0018)} />)}
    {level.walls.map(wall => <polyline key={wall.id} points={wallSubpath(wall, 0, undefined, Math.max(.2, width / 100)).map(point => `${point.x},${point.z}`).join(' ')}
      fill="none" stroke={wall.kind === 'interior' ? '#64716a' : '#33433e'}
      strokeWidth={Math.max(.08, wall.thickness)} strokeLinecap="round" strokeLinejoin="round" />)}
    {(level.seatingSections || []).map(section => {
      const outwardLength = Math.hypot(section.outward.x, section.outward.z) || 1
      const ox = section.outward.x / outwardLength, oz = section.outward.z / outwardLength
      const outerStart = { x: section.start.x + ox * section.rows * section.rowDepth, z: section.start.z + oz * section.rows * section.rowDepth }
      const outerEnd = { x: section.end.x + ox * section.rows * section.rowDepth, z: section.end.z + oz * section.rows * section.rowDepth }
      return <g key={section.id}>
        <polygon points={[section.start, section.end, outerEnd, outerStart].map(point => `${point.x},${point.z}`).join(' ')}
          fill={section.seatColor} fillOpacity=".2" stroke="#61756d" strokeWidth={Math.max(.04, width * .0015)} />
        {Array.from({ length: section.rows }, (_, row) => {
          const offset = (row + .5) * section.rowDepth
          return <line key={row} x1={section.start.x + ox * offset} y1={section.start.z + oz * offset}
            x2={section.end.x + ox * offset} y2={section.end.z + oz * offset}
            stroke="#61756d" strokeWidth={Math.max(.025, width * .0008)} />
        })}
      </g>
    })}
  </svg>
}

export function Dashboard({ projects, open, openSample, create, remove }: Props) {
  const [name, setName] = useState('')
  const [building, setBuilding] = useState('')
  const [units, setUnits] = useState<Project['units']>('m')
  const [previewId, setPreviewId] = useState<string | null>(null)
  const samples = useMemo(() => createSampleLibrary(), [])
  const [path, setPath ] = useState(window.location.pathname)
  return <main className="dashboard">
    <header className="dashboard-head">
      
      <div  className="brand-mark"><img src="/favicon.svg" alt="Erect3D logo" /></div>
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
      <section className="sample-library" aria-labelledby="sample-library-heading">
        <header className="sample-library-head">
          <div><div className="eyebrow">REAL EDITABLE PROJECTS</div><h2 id="sample-library-heading">Sample library</h2></div>
          <p>Open a model in the editor or duplicate it as a starting point.</p>
        </header>
        {categories.map(category => <section className="sample-category" key={category} aria-labelledby={`sample-${category}`}>
          <h3 id={`sample-${category}`}>{category}</h3>
          <div className="sample-grid">{samples.filter(sample => sample.category === category).map(sample => {
            const level = sample.project.buildings[0].levels[0]
            const active = previewId === sample.id
            return <article className={`sample-card${active ? ' preview-open' : ''}`} key={sample.id}>
              <div className="sample-card-top"><strong>{sample.title}</strong><span>{sample.project.buildings[0].levels.length} level{sample.project.buildings[0].levels.length === 1 ? '' : 's'}</span></div>
              <p>{sample.description}</p>
              <div className="sample-card-meta">{level.walls.length} walls · {level.rooms.length} spaces · {level.slabs?.length || 0} slabs</div>
              {active && <SamplePlan sample={sample} />}
              <div className="sample-card-actions">
                <button type="button" aria-expanded={active} onClick={() => setPreviewId(active ? null : sample.id)}>
                  {active ? 'Hide plan' : 'Preview plan'}
                </button>
                <button type="button" className="primary" onClick={() => openSample(sample.project, false)}>Open sample</button>
                <button type="button" className="quiet" onClick={() => openSample(sample.project, true)}>Duplicate</button>
              </div>
            </article>
          })}</div>
        </section>)}
      </section>
      <section className="dashboard-about" aria-label="About Erect 3D">
        <h2>From floor plan to editable 3D building</h2>
        <p>Work from a PNG, JPEG or PDF drawing, or start with a blank plan. Review detected walls, edit doors and windows, and configure rooms, floors, stairs, columns and roofs.</p>
        <h2>Explore the entire building</h2>
        <p>Design multiple levels with real elevations, inspect section and exploded views, then walk through the model in your browser. Projects are stored locally on this device.</p>
      </section>
    </div>
  </main>
}
