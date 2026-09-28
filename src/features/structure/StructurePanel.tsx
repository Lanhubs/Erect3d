import { useState } from 'react'
import { wallEnvelope, newSlab } from '../../domain/levels'
import { updateStair } from '../../domain/structure'
import { uid, type Level, type Point, type Project, type Selection, type Slab, type Stair } from '../../domain/types'
import { stairOpening } from '../../geometry/stairs'
import { containsPolygon } from '../../geometry/polygons'
import { polygonArea } from '../../geometry/quantities'
import { findStairPlacement } from '../../geometry/stairPlacement'
import { useProject } from '../../state/project'
import './structure.css'

const number = (value: string, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback
export function StructurePanel({ project, level, select }: { project: Project; level: Level; select: (selection: Selection) => void }) {
  const editProject = useProject(state => state.editProject)
  const [open, setOpen] = useState(false)
  const [targetId, setTargetId] = useState('')
  const [form, setForm] = useState<Stair['form']>('straight')
  const [voidSize, setVoidSize] = useState({ width: 2, depth: 2 })
  const [error, setError] = useState('')
  const upper = project.buildings[0].levels.filter(item => item.elevation > level.elevation).sort((a, b) => a.elevation - b.elevation)
  const target = upper.find(item => item.id === targetId) || upper[0]
  const apply = (change: (draft: Level) => void) => editProject(copy => {
    const draft = copy.buildings[0].levels.find(item => item.id === level.id)
    if (draft && !draft.locked) change(draft)
    return copy
  })
  const addSlab = () => { const polygon = wallEnvelope(level); if (polygon.length) apply(draft => { draft.slabs ||= []; draft.slabs.push(newSlab(polygon, draft.slabThickness)) }) }
  const updateSlab = (id: string, change: Partial<Slab>) => apply(draft => { const slab = draft.slabs?.find(item => item.id === id); if (slab) Object.assign(slab, change) })
  const updateOutline = (slab: Slab, index: number, axis: 'x' | 'z', value: number) => {
    const polygon = slab.polygon.map((point, position) => position === index ? { ...point, [axis]: value } : point)
    if (polygonArea(polygon) < .1 || slab.openings.some(opening => !containsPolygon(polygon, opening.polygon))) {
      setError('Keep the slab outline valid and around its openings.'); return
    }
    setError(''); updateSlab(slab.id, { polygon, autoFromWalls: false })
  }
  const moveOpening = (slab: Slab, openingId: string, axis: 'x' | 'z', value: number) => {
    const opening = slab.openings.find(item => item.id === openingId)
    if (!opening || opening.kind === 'stair') return
    const center = opening.polygon.reduce((sum, point) => sum + point[axis], 0) / opening.polygon.length
    const polygon = opening.polygon.map(point => ({ ...point, [axis]: point[axis] + value - center }))
    if (!containsPolygon(slab.polygon, polygon)) { setError('The opening must stay within the slab.'); return }
    setError(''); updateSlab(slab.id, { openings: slab.openings.map(item => item.id === openingId ? { ...item, polygon } : item) })
  }
  const addVoid = (slab: Slab) => {
    const xs = slab.polygon.map(point => point.x), zs = slab.polygon.map(point => point.z)
    const x = (Math.min(...xs) + Math.max(...xs)) / 2, z = (Math.min(...zs) + Math.max(...zs)) / 2
    const w = Math.min(voidSize.width, Math.max(.1, Math.max(...xs) - Math.min(...xs) - .2))
    const d = Math.min(voidSize.depth, Math.max(.1, Math.max(...zs) - Math.min(...zs) - .2))
    const polygon: Point[] = [{ x: x-w/2, z: z-d/2 }, { x: x+w/2, z: z-d/2 }, { x: x+w/2, z: z+d/2 }, { x: x-w/2, z: z+d/2 }]
    if (!containsPolygon(slab.polygon, polygon)) { setError('This opening does not fit inside the slab.'); return }
    setError(''); updateSlab(slab.id, { openings: [...slab.openings, { id: uid('opening'), kind: 'void', polygon }] })
  }
  const addStair = () => {
    if (!target) return
    const openingId = uid('opening')
    const initial: Stair = { id: uid('stair'), fromLevelId: level.id, toLevelId: target.id, start: { x: 0, z: 0 }, direction: 0,
      form, width: 1.1, riserHeight: .17, treadDepth: .28, landingLength: 1.2, openingId }
    const targetSlabs = target.slabs?.length ? target.slabs : [newSlab(wallEnvelope(target), target.slabThickness)]
    const stair = findStairPlacement(initial, project.buildings[0].levels, targetSlabs)
    if (!stair) { setError('No clear stair route fits within the upper slab. Adjust the plan or slab, then try again.'); return }
    const openingPolygon = stairOpening(stair, project.buildings[0].levels)
    setError('')
    editProject(copy => {
      const levels = copy.buildings[0].levels, from = levels.find(item => item.id === level.id), to = levels.find(item => item.id === target.id)
      if (!from || !to || from.locked || to.locked) return copy
      from.stairs ||= []; from.stairs.push(stair)
      to.slabs ||= []
      if (!to.slabs.length) { const polygon = wallEnvelope(to); if (polygon.length) to.slabs.push(newSlab(polygon, to.slabThickness)) }
      const opening = { id: openingId, kind: 'stair' as const, polygon: openingPolygon }
      to.slabs.find(slab => containsPolygon(slab.polygon, openingPolygon))?.openings.push(opening)
      return copy
    })
  }
  const changeStair = (id: string, change: Partial<Stair>) => {
    const probe = structuredClone(project)
    const issue = updateStair(probe, id, change)
    if (issue) { setError(issue); return }
    setError(''); editProject(copy => { updateStair(copy, id, change); return copy })
  }
  return <section className="structure-panel" aria-label="Structural elements">
    <button className="structure-toggle" onClick={() => setOpen(value => !value)} aria-expanded={open}>Structure · {level.slabs?.length || 0} slabs · {level.columns?.length || 0} columns · {level.stairs?.length || 0} stairs <span>{open ? '−' : '+'}</span></button>
    {open && <div className="structure-body">
      {error && <div className="inline-error" role="alert">{error}</div>}
      <div className="structure-row"><strong>Floor slabs</strong><button onClick={addSlab} disabled={!level.walls.length || level.locked}>Add from walls</button></div>
      {level.slabs?.map(slab => <div className="structure-card" key={slab.id}>
        <div className="structure-row"><b>Slab</b><button onClick={() => select({ kind: 'slab', id: slab.id })}>Inspect</button><button onClick={() => apply(draft => { draft.slabs = draft.slabs?.filter(item => item.id !== slab.id); draft.autoSlab = false })} disabled={level.locked}>Remove</button></div>
        <label>Thickness (m)<input type="number" min="0.05" max="1" step="0.01" key={`${slab.id}:${slab.thickness}`}
          defaultValue={slab.thickness} onBlur={event => updateSlab(slab.id, { thickness: Math.max(.05, number(event.target.value, .2)) })} /></label>
        <label>Structure<select value={slab.structuralMaterial} onChange={event => updateSlab(slab.id, { structuralMaterial: event.target.value as Slab['structuralMaterial'] })}><option value="reinforced-concrete">Reinforced concrete</option><option value="concrete">Concrete</option><option value="timber">Timber</option><option value="steel-deck">Steel deck</option></select></label>
        <label>Finish<select value={slab.finishMaterial} onChange={event => updateSlab(slab.id, { finishMaterial: event.target.value as Slab['finishMaterial'] })}>{['concrete','polished-concrete','tile','porcelain-tile','marble','timber','laminate','carpet'].map(value => <option key={value} value={value}>{value.replaceAll('-', ' ')}</option>)}</select></label>
        <details className="structure-outline"><summary>Edit slab outline · {slab.polygon.length} vertices</summary>
          {slab.polygon.map((point, index) => <div className="structure-row" key={index}><span>Point {index + 1}</span>
            {(['x','z'] as const).map(axis => <label key={axis}>{axis.toUpperCase()}<input type="number" step="0.1"
              key={`${slab.id}:${index}:${axis}:${point[axis]}`} defaultValue={point[axis]}
              onBlur={event => updateOutline(slab, index, axis, number(event.target.value, point[axis]))} /></label>)}
          </div>)}
        </details>
        <div className="structure-row"><span>{slab.openings.length} openings</span><button onClick={() => addVoid(slab)} disabled={level.locked}>Add opening</button></div>
        {slab.openings.map(opening => <div className="structure-opening" key={opening.id}>
          <div className="structure-row"><span>{opening.kind === 'void' ? 'Open below' : opening.kind}</span>{opening.kind === 'stair'
            ? <small>Managed by stair</small> : <button onClick={() => updateSlab(slab.id, { openings: slab.openings.filter(item => item.id !== opening.id) })}>Remove</button>}</div>
          {opening.kind !== 'stair' && (['x','z'] as const).map(axis => <label key={axis}>Centre {axis.toUpperCase()} · m<input type="number" step="0.1"
            key={`${opening.id}:${axis}:${opening.polygon[0][axis]}`} defaultValue={opening.polygon.reduce((sum, point) => sum + point[axis], 0) / opening.polygon.length}
            onBlur={event => moveOpening(slab, opening.id, axis, number(event.target.value, 0))} /></label>)}
        </div>)}
      </div>)}
      <div className="structure-row"><label>Opening width (m)<input type="number" min="0.2" value={voidSize.width} onChange={event => setVoidSize(value => ({ ...value, width: Math.max(.2, number(event.target.value, 2)) }))} /></label><label>Depth (m)<input type="number" min="0.2" value={voidSize.depth} onChange={event => setVoidSize(value => ({ ...value, depth: Math.max(.2, number(event.target.value, 2)) }))} /></label></div>
      <div className="structure-row"><strong>Columns</strong><button disabled={level.locked} onClick={() => apply(draft => { const outline = wallEnvelope(draft); draft.columns ||= []; draft.columns.push({ id: uid('column'), position: outline[0] || { x: 0, z: 0 }, shape: 'rectangular', width: .3, depth: .3, diameter: .3, height: draft.floorToFloorHeight || 3, material: 'concrete' }) })}>Add column</button></div>
      {level.columns?.map(column => <div className="structure-card" key={column.id}><div className="structure-row"><b>Column</b><button onClick={() => select({ kind: 'column', id: column.id })}>Inspect</button><button onClick={() => apply(draft => { draft.columns = draft.columns?.filter(item => item.id !== column.id) })}>Remove</button></div>
        <label>Shape<select value={column.shape} onChange={event => apply(draft => { const item = draft.columns?.find(value => value.id === column.id); if (item) item.shape = event.target.value as typeof item.shape })}><option value="rectangular">Rectangular</option><option value="circular">Circular</option></select></label>
        {(['x','z'] as const).map(axis => <label key={axis}>{axis.toUpperCase()} (m)<input type="number" step="0.1" defaultValue={column.position[axis]}
          onBlur={event => apply(draft => { const item = draft.columns?.find(value => value.id === column.id); if (item) item.position[axis] = number(event.target.value, 0) })} /></label>)}
        <label>Size (m)<input type="number" min="0.1" step="0.05" defaultValue={column.shape === 'circular' ? column.diameter : column.width}
          onBlur={event => apply(draft => { const item = draft.columns?.find(value => value.id === column.id); if (item) { item.width = number(event.target.value, .3); item.depth = item.width; item.diameter = item.width } })} /></label>
      </div>)}
      <div className="structure-row"><strong>Stairs</strong><button onClick={addStair} disabled={!target || level.locked || target.locked}>Connect to level</button></div>
      {upper.length > 0 && <div className="structure-row"><select aria-label="Destination level" value={target?.id || ''} onChange={event => setTargetId(event.target.value)}>{upper.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select aria-label="Stair form" value={form} onChange={event => setForm(event.target.value as Stair['form'])}><option value="straight">Straight</option><option value="L">L turn</option><option value="U">U turn</option></select></div>}
      {level.stairs?.map(stair => <div className="structure-card" key={stair.id}>
        <div className="structure-row"><b>{stair.form} stair → {project.buildings[0].levels.find(item => item.id === stair.toLevelId)?.name}</b><button onClick={() => select({ kind: 'stair', id: stair.id })}>Inspect</button><button onClick={() => editProject(copy => { const levels = copy.buildings[0].levels; const from = levels.find(item => item.id === level.id), to = levels.find(item => item.id === stair.toLevelId); if (from) from.stairs = from.stairs?.filter(item => item.id !== stair.id); to?.slabs?.forEach(slab => { slab.openings = slab.openings.filter(item => item.id !== stair.openingId) }); return copy })}>Remove</button></div>
        {(['x', 'z'] as const).map(axis => <label key={axis}>Start {axis.toUpperCase()} · m<input type="number" step="0.1" key={`${stair.id}:${axis}:${stair.start[axis]}`}
          defaultValue={stair.start[axis]} onBlur={event => changeStair(stair.id, { start: { ...stair.start, [axis]: number(event.target.value, stair.start[axis]) } })} /></label>)}
        {(['direction', 'width', 'riserHeight', 'treadDepth', 'landingLength'] as const).map(field => <label key={field}>{field === 'direction' ? 'Direction · °' : `${field.replace(/[A-Z]/g, value => ` ${value.toLowerCase()}`)} · m`}
          <input type="number" step={field === 'direction' ? 5 : .01} key={`${stair.id}:${field}:${stair[field]}`}
            defaultValue={stair[field]} onBlur={event => changeStair(stair.id, { [field]: number(event.target.value, stair[field]) })} /></label>)}
      </div>)}
    </div>}
  </section>
}
