import {useState} from 'react'
import type {ArchitecturalSample,SampleCategory} from '../../domain/sampleLibrary'
import {wallBoundsPoints,wallSubpath} from '../../geometry/math'
import {representedStoreys} from '../../domain/storeys'
const categories:SampleCategory[]=['Residential','Commercial','Public']
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
      fill={room.category === 'football-pitch' ? '#83a876' : room.category === 'table-tennis-hall' ? '#b4c6bc'
        : room.category === 'atrium' || room.category === 'field' ? '#dfe8e6' : '#e9e5d9'}
      stroke="#bcc4bb" strokeWidth={Math.max(.04, width * .002)} />)}
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
          fill={section.aisle ? '#c6bca5' : section.seatColor} fillOpacity={section.aisle ? '.85' : '.2'}
          stroke="#61756d" strokeWidth={Math.max(.04, width * .0015)} />
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

export function SampleLibrary({samples,openSample,busy,createBlocked,samplesError}:{samples:ArchitecturalSample[];openSample:(sample:ArchitecturalSample,duplicate:boolean)=>void;busy?:boolean;createBlocked?:boolean;samplesError?:string}){
  const [previewId,setPreviewId]=useState<string|null>(null)
  return (<section className="sample-library" aria-labelledby="sample-library-heading">
        <header className="sample-library-head">
          <div><div className="eyebrow">REAL EDITABLE PROJECTS</div><h2 id="sample-library-heading">Sample library</h2></div>
          <p>Open a model in the editor or duplicate it as a starting point.</p>
        </header>
        {samplesError && <p role="status">{samplesError}</p>}
        {!samples.length&&!samplesError&&<p role="status">Loading templates...</p>}
        {categories.map(category => <section className="sample-category" key={category} aria-labelledby={`sample-${category}`}>
          <h3 id={`sample-${category}`}>{category}</h3>
          <div className="sample-grid">{samples.filter(sample => sample.category === category).map(sample => {
            const level = sample.project.buildings[0].levels[0]
            const active = previewId === sample.id
            const count=representedStoreys(sample.project.buildings[0]),layouts=sample.project.buildings[0].levels.length,linked=count!==layouts
            return <article className={`sample-card${active ? ' preview-open' : ''}`} key={sample.id}>
              {sample.previewImage && <img className="sample-model-preview" src={sample.previewImage} alt={`${sample.title} · actual editable 3D model`} loading="lazy" width="960" height="720"/>}
              <div className="sample-card-top"><strong>{sample.title}</strong><span>{count} {linked?'storeys':`level${count===1?'':'s'}`}</span></div>
              <p>{sample.description}</p>
              <div className="sample-card-meta">{linked?`${layouts} editable layouts · ${sample.project.buildings[0].systems?.systems.filter(system=>system.kind==='typical-floors').length} linked floor groups`:`${level.walls.length} walls · ${level.rooms.length} spaces · ${level.slabs?.length || 0} slabs`}</div>
              {active && <SamplePlan sample={sample} />}
              <div className="sample-card-actions">
                <button type="button" aria-expanded={active} onClick={() => setPreviewId(active ? null : sample.id)}>
                  {active ? 'Hide plan' : 'Preview plan'}
                </button>
                <button disabled={busy || createBlocked} type="button" className="primary" onClick={() => openSample(sample, false)}>Open sample</button>
                <button disabled={busy || createBlocked} type="button" className="quiet" onClick={() => openSample(sample, true)}>Duplicate</button>
              </div>
            </article>
          })}</div>
        </section>)}
      </section>)
}
