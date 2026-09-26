import { defaultRoof, type Level, type Roof } from '../../domain/types'
import { useProject } from '../../state/project'

const materialColors: Record<Roof['material'], string> = {
  concrete: '#b8bbb8', 'standing-seam': '#5e6970', corrugated: '#78858a', 'concrete-tile': '#686c72',
}

export function RoofControls({ level }: { level: Level }) {
  const edit = useProject(state => state.edit)
  const roof = level.roof || defaultRoof
  const update = (change: Partial<Roof>) => edit(model => ({ ...model, roof: { ...roof, ...change } }))
  return <>
    <div className="panel-title">ROOF DESIGN</div>
    <div className="roof-controls">
      <label>Form
        <select aria-label="Roof form" value={roof.shape} onChange={event => {
          const shape = event.target.value as Roof['shape']
          update({ shape, pitch: shape === 'shed' ? Math.min(roof.pitch, 12) : roof.pitch })
        }}>
          <option value="hidden">Hidden flat roof</option>
          <option value="gable">Traditional gable</option>
          <option value="hip">Pitched hip</option>
          <option value="shed">Exposed mono-pitch</option>
        </select>
      </label>
      <label>Covering
        <select aria-label="Roof covering" value={roof.material} onChange={event => {
          const material = event.target.value as Roof['material']
          update({ material, color: materialColors[material] })
        }}>
          <option value="concrete">Smooth concrete</option>
          <option value="standing-seam">Standing-seam aluminium</option>
          <option value="corrugated">Corrugated aluminium</option>
          <option value="concrete-tile">Concrete roof tile</option>
        </select>
      </label>
      <label>Colour
        <input aria-label="Roof colour" type="color" value={roof.color} onChange={event => update({ color: event.target.value })} />
      </label>
      {roof.shape !== 'hidden' && <label>Pitch · {roof.pitch}°
        <input aria-label="Roof pitch" type="range" min={roof.shape === 'shed' ? 3 : 8} max={roof.shape === 'shed' ? 24 : 48} value={roof.pitch}
          onChange={event => update({ pitch: Number(event.target.value) })} />
      </label>}
      <label>Overhang · {roof.overhang.toFixed(2)} m
        <input aria-label="Roof overhang" type="range" min="0" max="1.2" step="0.05" value={roof.overhang}
          onChange={event => update({ overhang: Number(event.target.value) })} />
      </label>
      <p>Use Hide roof in 3D to inspect rooms and walls.</p>
    </div>
  </>
}
