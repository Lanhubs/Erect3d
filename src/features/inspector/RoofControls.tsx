import { defaultRoof, uid, type Level, type Roof, type RoofSection } from '../../domain/types'
import { topLevel, wallEnvelope } from '../../domain/levels'
import { splitRoofFootprint } from '../../geometry/roofSections'
import { useProject } from '../../state/project'

const materialColors: Record<Roof['material'], string> = {
  concrete: '#b8bbb8', 'standing-seam': '#5e6970', corrugated: '#78858a', 'concrete-tile': '#686c72',
}

export function RoofControls({ level }: { level: Level }) {
  const editProject = useProject(state => state.editProject)
  const building = useProject(state => state.project?.buildings[0])
  const roof = building?.roof || level.roof || defaultRoof
  const sections = building?.roofSections || []
  const update = (change: Partial<Roof>) => editProject(copy => {
    const target = copy.buildings[0], next = { ...roof, ...change }
    target.roof = next; topLevel(target).roof = next
    return copy
  })
  const splitSection = (section?: RoofSection) => {
    if (!building) return
    const targetLevel = section ? building.levels.find(item => item.id === section.levelId) : topLevel(building)
    if (!targetLevel) return
    const pieces = splitRoofFootprint(section?.footprint || wallEnvelope(targetLevel))
    if (!pieces) return
    const baseRoof = section?.roof || roof
    const next = pieces.map((footprint, index): RoofSection => ({
      id: uid('roof-section'), name: `${section?.name || 'Main roof'} ${index ? 'B' : 'A'}`,
      levelId: targetLevel.id, footprint, topHeight: section?.topHeight || Math.max(2.7, ...targetLevel.walls.map(wall => wall.height)),
      roof: { ...baseRoof, overhang: Math.min(.15, baseRoof.overhang) },
    }))
    editProject(copy => {
      const target = copy.buildings[0]
      target.roofSections = section ? (target.roofSections || []).flatMap(item => item.id === section.id ? next : [item]) : next
      return copy
    })
  }
  const updateSection = (id: string, change: Partial<RoofSection>) => editProject(copy => {
    const target = copy.buildings[0]
    target.roofSections = target.roofSections?.map(section => section.id === id ? { ...section, ...change } : section)
    return copy
  })
  const updateSectionRoof = (id: string, change: Partial<Roof>) => editProject(copy => {
    const target = copy.buildings[0]
    target.roofSections = target.roofSections?.map(section => section.id === id
      ? { ...section, roof: { ...section.roof, ...change } } : section)
    return copy
  })
  return <>
    <div className="panel-title">ROOF DESIGN</div>
    {!sections.length && <div className="roof-controls">
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
      <button type="button" className="inspector-action" disabled={!building || !topLevel(building).walls.length}
        onClick={() => splitSection()}>Split into roof sections</button>
    </div>}
    {sections.length > 0 && <div className="roof-section-list">
      <div className="roof-section-toolbar"><strong>{sections.length} roof sections</strong>
        <button type="button" onClick={() => splitSection(sections[0])}>Split section</button></div>
      {sections.map(section => <div className="roof-section-card" key={section.id}>
        <label className="inspector-field"><span>Section</span><input key={`${section.id}:${section.name}`} defaultValue={section.name}
          onBlur={event => updateSection(section.id, { name: event.target.value })} /></label>
        <label className="inspector-field"><span>Form</span><select value={section.roof.shape}
          onChange={event => updateSectionRoof(section.id, { shape: event.target.value as Roof['shape'] })}>
          <option value="hidden">Flat</option><option value="gable">Gable</option><option value="hip">Hip</option><option value="shed">Shed</option>
        </select></label>
        <label className="inspector-field"><span>Material</span><select value={section.roof.material}
          onChange={event => updateSectionRoof(section.id, { material: event.target.value as Roof['material'] })}>
          <option value="concrete">Concrete</option><option value="standing-seam">Standing seam</option>
          <option value="corrugated">Corrugated</option><option value="concrete-tile">Concrete tile</option>
        </select></label>
        <label className="inspector-field"><span>Color</span><input type="color" value={section.roof.color}
          onChange={event => updateSectionRoof(section.id, { color: event.target.value })} /></label>
        <label className="inspector-field"><span>Top height · m</span><input type="number" min="2" step="0.1"
          value={section.topHeight || 3} onChange={event => updateSection(section.id,
            { topHeight: Math.max(2, Number(event.target.value)) })} /></label>
        {section.roof.shape !== 'hidden' && <label className="roof-section-range">Pitch · {section.roof.pitch}°
          <input type="range" min={section.roof.shape === 'shed' ? 3 : 8} max={section.roof.shape === 'shed' ? 24 : 48}
            value={section.roof.pitch} onChange={event => updateSectionRoof(section.id, { pitch: Number(event.target.value) })} />
        </label>}
        <label className="roof-section-range">Overhang · {section.roof.overhang.toFixed(2)} m
          <input type="range" min="0" max="1.2" step="0.05" value={section.roof.overhang}
            onChange={event => updateSectionRoof(section.id, { overhang: Number(event.target.value) })} />
        </label>
        <details className="roof-section-outline"><summary>Footprint · {section.footprint.length} points</summary>
          {section.footprint.map((point, index) => <div className="roof-section-point" key={index}>
            <span>P{index + 1}</span>{(['x','z'] as const).map(axis => <label key={axis}>{axis.toUpperCase()}
              <input type="number" step="0.1" key={`${section.id}:${index}:${axis}:${point[axis]}`} defaultValue={point[axis]}
                onBlur={event => updateSection(section.id, { footprint: section.footprint.map((item, pointIndex) =>
                  pointIndex === index ? { ...item, [axis]: Number(event.target.value) } : item) })} />
            </label>)}
          </div>)}
        </details>
        <button type="button" className="inspector-action" disabled={section.footprint.length < 4}
          onClick={() => splitSection(section)}>Split section</button>
        <button type="button" className="roof-section-remove" onClick={() => editProject(copy => {
          const target = copy.buildings[0]
          target.roofSections = target.roofSections?.filter(item => item.id !== section.id)
          return copy
        })}>Remove section</button>
      </div>)}
      <p>Roof sections render independently. The model returns to the single-roof setting when the last section is removed.</p>
    </div>}
  </>
}
