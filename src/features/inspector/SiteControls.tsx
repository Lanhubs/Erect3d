import type { Building, FenceMaterial, Point, SiteFence } from '../../domain/types'
import { uid } from '../../domain/types'
import { generateSiteFence, insertBoundaryPoint, updateFenceBoundary } from '../../geometry/site'
import { useProject } from '../../state/project'

const materialOptions: Array<[FenceMaterial, string]> = [
  ['metal', 'Metal'], ['timber', 'Timber'], ['concrete', 'Concrete'], ['brick', 'Brick'],
]

export function SiteControls({ building }: { building: Building }) {
  const editProject = useProject(state => state.editProject)
  const fence = building.siteFence
  const boundary = fence?.boundary || fence?.segments.map(segment => segment.start) || []
  const enabled = Boolean(fence && fence.enabled !== false)
  const ground = [...building.levels].sort((a, b) => a.elevation - b.elevation)[0]
  const updateFence = (change: (current: SiteFence | undefined) => SiteFence | undefined) => editProject(project => {
    const target = project.buildings.find(item => item.id === building.id)
    if (target) target.siteFence = change(target.siteFence)
    return project
  })
  const changeBoundary = (next: Point[]) => updateFence(current => current ? updateFenceBoundary(current, next) : current)
  const addGate = (kind: 'pedestrian' | 'vehicle') => updateFence(current => {
    if (!current?.segments.length) return current
    const segment = current.segments[0]
    const length = Math.hypot(segment.end.x - segment.start.x, segment.end.z - segment.start.z)
    const width = kind === 'vehicle' ? 3.2 : 1
    if (length < width + .4) return current
    return { ...current, gates: [...current.gates, { id: uid('fence-gate'), kind, segmentId: segment.id,
      offset: Math.max(.2, (length - width) / 2), width, height: kind === 'vehicle' ? 1.5 : 1.2,
      material: current.material }] }
  })
  const onToggle = () => updateFence(current => {
    if (current) return { ...current, enabled: current.enabled === false }
    return generateSiteFence(ground)
  })
  const onAutoGenerate = () => updateFence(current => generateSiteFence(ground, current?.setbacks, current))
  const setSetback = (side: 'front' | 'rear' | 'left' | 'right', value: number) => updateFence(current => {
    const generated = generateSiteFence(ground, { front: 4, rear: 3, left: 3, right: 3, ...current?.setbacks,
      [side]: Math.max(0, value) }, current)
    return generated
  })
  return <section className="site-controls">
    <div className="panel-title">SITE · BOUNDARY & FENCE</div>
    <label className="site-toggle"><span>Site fence</span><input aria-label="Site fence" type="checkbox" checked={enabled} onChange={onToggle} /></label>
    <div className="site-actions">
      <button type="button" disabled={!ground.walls.length} onClick={onAutoGenerate}>Auto generate</button>
      {fence && <label className="inspector-field"><span>Material</span><select value={fence.material}
        onChange={event => updateFence(current => current && { ...current, material: event.target.value as FenceMaterial,
          segments: current.segments.map(segment => ({ ...segment, material: event.target.value as FenceMaterial })) })}>
        {materialOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>}
      {fence && <label className="inspector-field"><span>Color</span><input aria-label="Fence color" type="color" value={fence.color || '#68716e'}
        onChange={event => updateFence(current => current && ({ ...current, color: event.target.value }))} /></label>}
    </div>
    {fence && <>
      <div className="site-subtitle">FENCE</div>
      <label className="inspector-field"><span>Height · m</span><input aria-label="Fence height" type="number" min="0.4" step="0.1"
        key={`${fence.id}:height:${fence.height}`} defaultValue={fence.height} onBlur={event => updateFence(current => current && ({ ...current, height: Math.max(.4, Number(event.target.value)),
          segments: current.segments.map(segment => ({ ...segment, height: Math.max(.4, Number(event.target.value)) })) }))} /></label>
      <label className="inspector-field"><span>Thickness · m</span><input aria-label="Fence thickness" type="number" min="0.04" step="0.02"
        key={`${fence.id}:thickness:${fence.thickness}`} defaultValue={fence.thickness} onBlur={event => updateFence(current => current && ({ ...current, thickness: Math.max(.04, Number(event.target.value)),
          segments: current.segments.map(segment => ({ ...segment, thickness: Math.max(.04, Number(event.target.value)) })) }))} /></label>
      <div className="site-subtitle">SETBACKS · m</div>
      {(['front', 'rear', 'left', 'right'] as const).map(side => <label className="inspector-field" key={side}>
        <span>{side[0].toUpperCase() + side.slice(1)}</span><input aria-label={`${side} setback`} type="number" min="0" step="0.25"
          key={`${fence.id}:setback:${side}:${fence.setbacks?.[side] ?? ({ front: 4, rear: 3, left: 3, right: 3 }[side])}`} defaultValue={fence.setbacks?.[side] ?? ({ front: 4, rear: 3, left: 3, right: 3 }[side])}
          onBlur={event => setSetback(side, Number(event.target.value))} /></label>)}
      <div className="site-subtitle">BOUNDARY POINTS</div>
      {boundary.map((point, index) => <div className="site-point" key={`${fence.id}:point:${index}`}>
        <span>P{index + 1}</span>
        <label><span>X</span><input aria-label={`Boundary point ${index + 1} X`} type="number" step="0.1" key={`${fence.id}:${index}:${point.x}:x`} defaultValue={point.x}
          onBlur={event => { const next = boundary.map(item => ({ ...item })); next[index].x = Number(event.target.value); changeBoundary(next) }} /></label>
        <label><span>Z</span><input aria-label={`Boundary point ${index + 1} Z`} type="number" step="0.1" key={`${fence.id}:${index}:${point.z}:z`} defaultValue={point.z}
          onBlur={event => { const next = boundary.map(item => ({ ...item })); next[index].z = Number(event.target.value); changeBoundary(next) }} /></label>
        <button type="button" aria-label={`Delete boundary point ${index + 1}`} disabled={boundary.length <= 3}
          onClick={() => changeBoundary(boundary.filter((_, itemIndex) => itemIndex !== index))}>×</button>
      </div>)}
      <button type="button" className="site-add" onClick={() => changeBoundary(insertBoundaryPoint(boundary))}>Add boundary point</button>
      <div className="site-subtitle">GATES</div>
      {fence.gates.map(gate => <div className="site-gate" key={gate.id}>
        <strong>{gate.kind === 'vehicle' ? 'Vehicle' : 'Pedestrian'}</strong>
        <label><span>Position</span><input aria-label={`${gate.kind} gate position`} type="number" min="0" step="0.1" key={`${gate.id}:offset:${gate.offset}`} defaultValue={gate.offset}
          onBlur={event => updateFence(current => current && ({ ...current, gates: current.gates.map(item => item.id === gate.id
            ? { ...item, offset: Math.max(0, Number(event.target.value)) } : item) }))} /></label>
        <label><span>Width · m</span><input aria-label={`${gate.kind} gate width`} type="number" min="0.6" step="0.1" key={`${gate.id}:width:${gate.width}`} defaultValue={gate.width}
          onBlur={event => updateFence(current => current && ({ ...current, gates: current.gates.map(item => item.id === gate.id
            ? { ...item, width: Math.max(.6, Number(event.target.value)) } : item) }))} /></label>
        <label><span>Height · m</span><input aria-label={`${gate.kind} gate height`} type="number" min="0.6" step="0.1" key={`${gate.id}:height:${gate.height}`} defaultValue={gate.height}
          onBlur={event => updateFence(current => current && ({ ...current, gates: current.gates.map(item => item.id === gate.id
            ? { ...item, height: Math.max(.6, Number(event.target.value)) } : item) }))} /></label>
        <label><span>Material</span><select value={gate.material || fence.material} onChange={event => updateFence(current => current && ({ ...current,
          gates: current.gates.map(item => item.id === gate.id ? { ...item, material: event.target.value as FenceMaterial } : item) }))}>
          {materialOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <button type="button" aria-label={`Delete ${gate.kind} gate`} onClick={() => updateFence(current => current && ({ ...current,
          gates: current.gates.filter(item => item.id !== gate.id) }))}>Remove</button>
      </div>)}
      <div className="site-actions"><button type="button" onClick={() => addGate('pedestrian')}>Add pedestrian gate</button>
        <button type="button" onClick={() => addGate('vehicle')}>Add vehicle gate</button></div>
    </>}
  </section>
}