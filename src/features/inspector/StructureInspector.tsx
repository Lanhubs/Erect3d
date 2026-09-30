import { useState } from 'react'
import type { Building, Level, Selection, Slab, Stair } from '../../domain/types'
import { updateStair } from '../../domain/structure'
import { polygonArea, slabArea } from '../../geometry/quantities'
import { formatArea, toDisplay, toMetres, type Unit } from '../../geometry/units'
import { useProject } from '../../state/project'
import { SiteControls } from './SiteControls'

export function StructureInspector({ building, level, selection, unit, open, onClose }: { building: Building; level: Level; selection: Selection;
  unit: Unit; open?: boolean; onClose?: () => void }) {
  const editProject = useProject(state => state.editProject), select = useProject(state => state.setSelection)
  const [error, setError] = useState('')
  const slab = level.slabs?.find(item => item.id === selection?.id)
  const column = level.columns?.find(item => item.id === selection?.id)
  const stair = level.stairs?.find(item => item.id === selection?.id)
  const editLevel = (change: (draft: Level) => void) => editProject(copy => {
    const draft = copy.buildings[0].levels.find(item => item.id === level.id)
    if (draft && !draft.locked) change(draft)
    return copy
  })
  const changeSlab = (change: Partial<Slab>) => editLevel(draft => {
    const found = draft.slabs?.find(item => item.id === slab?.id)
    if (found) Object.assign(found, change)
  })
  const changeStair = (change: Partial<Stair>) => {
    const current = useProject.getState().project
    if (!current || !stair) return
    const probe = structuredClone(current), issue = updateStair(probe, stair.id, change)
    if (issue) { setError(issue); return }
    setError(''); editProject(copy => { updateStair(copy, stair.id, change); return copy })
  }
  const remove = () => {
    editProject(copy => {
      const levels = copy.buildings[0].levels, draft = levels.find(item => item.id === level.id)
      if (!draft || draft.locked) return copy
      if (slab) draft.slabs = draft.slabs?.filter(item => item.id !== slab.id)
      if (column) draft.columns = draft.columns?.filter(item => item.id !== column.id)
      if (stair) { draft.stairs = draft.stairs?.filter(item => item.id !== stair.id)
        levels.find(item => item.id === stair.toLevelId)?.slabs?.forEach(item => {
          item.openings = item.openings.filter(opening => opening.id !== stair.openingId)
        }) }
      return copy
    })
    select(null)
  }
  return <aside className={`inspector${open ? ' mobile-open' : ''}`}>
    <div className="inspector-mobile-head"><strong>{selection?.kind} properties</strong><button onClick={onClose} aria-label="Close properties">×</button></div>
    <SiteControls building={building} />
    <div className="panel-title">STRUCTURE</div>
    <div className="entity-title"><strong>{selection?.kind.toUpperCase()}</strong><small>{selection?.id}</small></div>
    {error && <div className="inline-error" role="alert">{error}</div>}
    {slab && <div className="fields">
      <div className="readout"><span>Net slab area</span><b>{formatArea(slabArea(slab), unit)}</b></div>
      <div className="readout"><span>Openings</span><b>{slab.openings.length} · {formatArea(polygonArea(slab.polygon) - slabArea(slab), unit)}</b></div>
      <label className="inspector-field"><span>Structure</span><select value={slab.structuralMaterial}
        onChange={event => changeSlab({ structuralMaterial: event.target.value as Slab['structuralMaterial'] })}>
        <option value="reinforced-concrete">Reinforced concrete</option><option value="concrete">Concrete</option>
        <option value="timber">Timber</option><option value="steel-deck">Steel deck</option></select></label>
      <label className="inspector-field"><span>Thickness · {unit}</span><input type="number" min="0.05" step="0.01"
        key={`${slab.id}:${slab.thickness}`} defaultValue={toDisplay(slab.thickness, unit)}
        onBlur={event => changeSlab({ thickness: Math.max(.05, toMetres(Number(event.target.value), unit)) })} /></label>
      <label className="inspector-field"><span>Floor finish</span><select value={slab.finishMaterial}
        onChange={event => changeSlab({ finishMaterial: event.target.value as Slab['finishMaterial'] })}>
        {['concrete','polished-concrete','tile','porcelain-tile','marble','timber','laminate','carpet'].map(item =>
          <option key={item} value={item}>{item.replaceAll('-', ' ')}</option>)}</select></label>
      <label className="inspector-field"><span>Finish tint</span><input type="color" value={slab.color || '#ffffff'}
        onChange={event => changeSlab({ color: event.target.value })} /></label>
    </div>}
    {column && <div className="fields">
      <label className="inspector-field"><span>Shape</span><select value={column.shape} onChange={event => editLevel(draft => {
        const found = draft.columns?.find(item => item.id === column.id); if (found) found.shape = event.target.value as typeof found.shape
      })}><option value="rectangular">Rectangular</option><option value="circular">Circular</option></select></label>
      <label className="inspector-field"><span>Material</span><select value={column.material} onChange={event => editLevel(draft => {
        const found = draft.columns?.find(item => item.id === column.id); if (found) found.material = event.target.value as typeof found.material
      })}><option value="concrete">Concrete</option><option value="steel">Steel</option><option value="timber">Timber</option></select></label>
      {(['width','depth','diameter','height'] as const).filter(field => field === 'height' ||
        (column.shape === 'circular' ? field === 'diameter' : field === 'width' || field === 'depth')).map(field =>
        <label className="inspector-field" key={field}><span>{field} · {unit}</span><input type="number" min="0.1" step="0.05"
          key={`${column.id}:${field}:${column[field]}`} defaultValue={toDisplay(column[field], unit)} onBlur={event => editLevel(draft => {
            const found = draft.columns?.find(item => item.id === column.id); if (found) found[field] = Math.max(.1, toMetres(Number(event.target.value), unit))
          })} /></label>)}
    </div>}
    {stair && <div className="fields">
      <div className="readout"><span>Connects</span><b>{level.name} → {useProject.getState().project?.buildings[0].levels.find(item => item.id === stair.toLevelId)?.name}</b></div>
      <label className="inspector-field"><span>Form</span><select value={stair.form} onChange={event => changeStair({ form: event.target.value as Stair['form'] })}>
        <option value="straight">Straight</option><option value="L">L turn</option><option value="U">U turn</option></select></label>
      {(['width','riserHeight','treadDepth','landingLength'] as const).map(field => <label className="inspector-field" key={field}>
        <span>{field.replace(/[A-Z]/g, value => ` ${value.toLowerCase()}`)} · {unit}</span><input type="number" min="0.1" step="0.01"
          key={`${stair.id}:${field}:${stair[field]}`} defaultValue={toDisplay(stair[field], unit)}
          onBlur={event => changeStair({ [field]: toMetres(Number(event.target.value), unit) })} /></label>)}
      <label className="inspector-field"><span>Direction · °</span><input type="number" step="5" key={`${stair.id}:direction:${stair.direction}`}
        defaultValue={stair.direction} onBlur={event => changeStair({ direction: Number(event.target.value) })} /></label>
    </div>}
    <button className="delete-button" disabled={level.locked} onClick={remove}>Delete element</button>
  </aside>
}
