import { useState } from 'react'
import type { Level, Project } from '../../domain/types'
import { blankLevel, connectAdjacentLevels, duplicateLevel, translateLevel } from '../../domain/levels'
import { useProject } from '../../state/project'
import './levels.css'

type Props = { project: Project; activeId: string; isolateId: string | null; setIsolateId: (id: string | null) => void;
  underlayId: string | null; setUnderlayId: (id: string | null) => void }
function LevelRow({ level, active, select, change, remove, duplicate, isolate, isolated }: {
  level: Level; active: boolean; select: () => void; change: (changes: Partial<Level>) => void;
  remove: () => void; duplicate: () => void; isolate: () => void; isolated: boolean
}) {
  return <div className={`level-row${active ? ' active' : ''}`}>
    <button className="level-select" onClick={select} aria-current={active ? 'true' : undefined}>{level.name}<small>{level.elevation.toFixed(2)} m</small></button>
    <button title={level.visible === false ? 'Show level' : 'Hide level'} aria-label={`${level.visible === false ? 'Show' : 'Hide'} ${level.name}`}
      onClick={() => change({ visible: level.visible === false })}>{level.visible === false ? '○' : '●'}</button>
    <button title={isolated ? 'Show building' : 'Isolate level'} aria-label={`${isolated ? 'Show building' : 'Isolate'} ${level.name}`}
      onClick={isolate}>{isolated ? '◎' : '◉'}</button>
    <button title={level.locked ? 'Unlock level' : 'Lock level'} aria-label={`${level.locked ? 'Unlock' : 'Lock'} ${level.name}`}
      onClick={() => change({ locked: !level.locked })}>{level.locked ? '🔒' : '◇'}</button>
    {active && <div className="level-properties">
      <label>Name <input aria-label="Level name" key={`${level.id}:name`} defaultValue={level.name}
        onBlur={event => { if (event.target.value.trim() && event.target.value !== level.name) change({ name: event.target.value.trim() }) }} /></label>
      <label>Elevation · m <input aria-label="Level elevation" type="number" step=".1" key={`${level.id}:elevation`}
        defaultValue={level.elevation} onBlur={event => { const value = Number(event.target.value); if (Number.isFinite(value) && value !== level.elevation) change({ elevation: value }) }} /></label>
      <label>Floor to floor · m <input aria-label="Floor to floor height" type="number" min="2.2" step=".1" key={`${level.id}:height`}
        defaultValue={level.floorToFloorHeight || 3} onBlur={event => { const value = Number(event.target.value); if (value >= 2.2 && value !== level.floorToFloorHeight) change({ floorToFloorHeight: value }) }} /></label>
      {(['x', 'z'] as const).map(axis => <label key={axis}>Plan offset {axis.toUpperCase()} · m
        <input aria-label={`Plan offset ${axis.toUpperCase()}`} type="number" step=".1" key={`${level.id}:offset:${axis}:${level.alignment?.[axis] || 0}`}
          defaultValue={level.alignment?.[axis] || 0} onBlur={event => { const value = Number(event.target.value); if (Number.isFinite(value)) change({ alignment: { x: level.alignment?.x || 0, z: level.alignment?.z || 0, [axis]: value } }) }} />
      </label>)}
      <div className="level-actions"><button onClick={duplicate}>Duplicate</button><button onClick={remove}>Delete</button></div>
    </div>}
  </div>
}

export function LevelManager({ project, activeId, isolateId, setIsolateId, underlayId, setUnderlayId }: Props) {
  const building = project.buildings[0], levels = [...building.levels].sort((a, b) => b.elevation - a.elevation)
  const top = building.levels.reduce((highest, level) => level.elevation > highest.elevation ? level : highest)
  const active = building.levels.find(level => level.id === activeId) || building.levels[0]
  const editProject = useProject(state => state.editProject), setActiveLevel = useProject(state => state.setActiveLevel)
  const [adding, setAdding] = useState(false), [name, setName] = useState(''), [elevation, setElevation] = useState(top.elevation + (top.floorToFloorHeight || 3))
  const [height, setHeight] = useState(top.floorToFloorHeight || 3), [from, setFrom] = useState('blank')
  const change = (id: string, changes: Partial<Level>) => editProject(next => {
    const target = next.buildings[0].levels.find(level => level.id === id)!
    if (changes.alignment) translateLevel(target, { x: changes.alignment.x - (target.alignment?.x || 0),
      z: changes.alignment.z - (target.alignment?.z || 0) })
    Object.assign(target, changes)
    next.buildings[0].levels.sort((a, b) => a.elevation - b.elevation)
    return next
  })
  const add = () => {
    if (!name.trim() || !Number.isFinite(elevation) || height < 2.2) return
    const source = building.levels.find(level => level.id === from)
    const next = source ? duplicateLevel(source, name.trim(), elevation) : blankLevel(name.trim(), elevation, height)
    next.floorToFloorHeight = height
    editProject(copy => { copy.buildings[0].levels.push(next); copy.buildings[0].levels.sort((a, b) => a.elevation - b.elevation); connectAdjacentLevels(copy); return copy })
    setActiveLevel(next.id); setAdding(false); setIsolateId(null)
  }
  const duplicate = (source: Level) => {
    const next = duplicateLevel(source, `${source.name} copy`, top.elevation + (top.floorToFloorHeight || 3))
    editProject(copy => { copy.buildings[0].levels.push(next); copy.buildings[0].levels.sort((a, b) => a.elevation - b.elevation); connectAdjacentLevels(copy); return copy })
    setActiveLevel(next.id)
    setIsolateId(null)
  }
  const remove = (id: string) => {
    if (building.levels.length === 1) return
    editProject(copy => { const levels = copy.buildings[0].levels
      const removed = new Set(levels.flatMap(level => level.stairs || [])
        .filter(stair => stair.fromLevelId === id || stair.toLevelId === id).map(stair => stair.openingId))
      copy.buildings[0].levels = levels.filter(level => level.id !== id)
      for (const level of copy.buildings[0].levels) { level.stairs = level.stairs?.filter(stair => stair.fromLevelId !== id && stair.toLevelId !== id)
        level.slabs?.forEach(slab => { slab.openings = slab.openings.filter(opening => !removed.has(opening.id)) }) }
      return copy })
    if (activeId === id) setActiveLevel(building.levels.find(level => level.id !== id)!.id)
    if (isolateId === id) setIsolateId(null)
    if (underlayId === id) setUnderlayId(null)
  }
  return <details className="level-manager"><summary>LEVELS <b>{active.name}</b><span>{active.elevation.toFixed(2)} m · {levels.length} floor{levels.length === 1 ? '' : 's'}</span></summary>
    <div className="level-manager-body">
      <div className="level-manager-head"><strong>Building levels</strong><button onClick={() => { setIsolateId(null); editProject(copy => {
        copy.buildings[0].levels.forEach(level => { level.visible = true }); return copy }) }}>Show all</button></div>
      {levels.map(level => <LevelRow key={level.id} level={level} active={level.id === activeId}
        select={() => setActiveLevel(level.id)} change={changes => change(level.id, changes)}
        duplicate={() => duplicate(level)} remove={() => remove(level.id)}
        isolate={() => setIsolateId(isolateId === level.id ? null : level.id)} isolated={isolateId === level.id} />)}
      <label className="underlay-choice">Plan underlay <select value={underlayId || ''} onChange={event => setUnderlayId(event.target.value || null)}>
        <option value="">None</option>{levels.filter(level => level.id !== activeId).map(level => <option key={level.id} value={level.id}>{level.name}</option>)}
      </select></label>
      {!adding ? <button className="level-add" onClick={() => { setName(`Level ${String(levels.length).padStart(2, '0')}`); setElevation(top.elevation + (top.floorToFloorHeight || 3)); setHeight(top.floorToFloorHeight || 3); setAdding(true) }}>+ Add Level</button>
        : <div className="level-add-form"><strong>Add level</strong>
          <label>Name <input value={name} onChange={event => setName(event.target.value)} /></label>
          <label>Elevation · m <input type="number" step=".1" value={elevation} onChange={event => setElevation(Number(event.target.value))} /></label>
          <label>Floor to floor · m <input type="number" min="2.2" step=".1" value={height} onChange={event => setHeight(Number(event.target.value))} /></label>
          <label>Start from <select value={from} onChange={event => setFrom(event.target.value)}><option value="blank">Blank level</option>
            {levels.map(level => <option key={level.id} value={level.id}>{level.name}</option>)}</select></label>
          <div className="level-actions"><button className="primary" onClick={add}>Add level</button><button onClick={() => setAdding(false)}>Cancel</button></div>
        </div>}
    </div>
  </details>
}
