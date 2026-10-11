import type { Level } from '../domain/types'
import { estimatedVariant, furnitureDimensions, furnitureIssues } from './entities'
import { furnitureLabel, furnitureTypes, type FurnitureType } from './types'
import { useFurnitureReview } from './reviewState'
export function FurnitureReview({ level, levels }: { level: Level; levels: Level[] }) {
  const { candidates, selected, select, patch, remove } = useFurnitureReview()
  const object = candidates.find(item => item.id === selected)
  return <div className="furniture-review">
    <div className="furniture-candidates" aria-label="Furniture proposals">{candidates.map(item => <button key={item.id} aria-pressed={selected === item.id}
      className={`proposal-${item.status}`} onClick={() => select(item.id)}>{furnitureLabel(item.type)} · {Math.round(item.confidence * 100)}% · {item.status === 'uncertain' ? 'Needs review' : item.status}</button>)}</div>
    {object && <div className="furniture-correction">
      <label>Type <select aria-label="Detected furniture type" value={object.type} onChange={event => { const type = event.target.value as FurnitureType, assetId = estimatedVariant(type, object.width)
        patch(object.id, { type, assetId, height: furnitureDimensions(type, assetId)[2], status: 'uncertain' }) }}>
        {furnitureTypes.map(type => <option key={type} value={type}>{furnitureLabel(type)}</option>)}</select></label>
      {(['x', 'z'] as const).map(axis => <label key={axis}>{axis.toUpperCase()} · m<input aria-label={`Proposal ${axis}`} type="number" step=".05" value={Number(object.position[axis].toFixed(3))}
        onChange={event => { const value = Number(event.target.value); if (Number.isFinite(value)) patch(object.id, { position: { ...object.position, [axis]: value }, status: 'uncertain' }) }} /></label>)}
      {(['width', 'depth', 'rotation'] as const).map(field => <label key={field}>{field} · {field === 'rotation' ? '°' : 'm'}<input aria-label={`Proposal ${field}`} type="number"
        step={field === 'rotation' ? '5' : '.05'} value={Number(object[field].toFixed(3))} onChange={event => { const value = Number(event.target.value)
          if (Number.isFinite(value) && (field === 'rotation' || value >= .08)) patch(object.id, { [field]: value, status: 'uncertain' }) }} /></label>)}
      <span className="furniture-warnings">{furnitureIssues(object, level, levels).issues.join(' · ') || 'Within the reviewed floor footprint'}</span>
      <button onClick={() => patch(object.id, { status: 'accepted' })}>Accept</button><button onClick={() => patch(object.id, { status: 'rejected' })}>Reject</button>
      <button onClick={() => remove(object.id)}>Delete proposal</button>
    </div>}
  </div>
}
