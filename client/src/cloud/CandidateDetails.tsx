import type { Candidate } from '../../../api/src/contracts/analysis'
import { useProject } from '../state/project'
import { furnitureTypes } from '../furniture/types'
export function CandidateDetails({ candidate, update, disabled, walls }: { candidate: Candidate; update: (candidate: Candidate) => void; disabled: boolean; walls: { id: string; label?: string }[] }) {
  const levels = useProject(state => state.project?.buildings[0].levels || [])
  if (candidate.action==='remove') return <details><summary>Removal evidence</summary>
    <p>{candidate.evidence}</p>{candidate.uncertainties.map((text,index)=><p key={index}>{text}</p>)}
    <p>This proposes removing the highlighted existing element. It adds no replacement geometry.</p>
    {candidate.kind==='wall' && <p>Hosted doors and windows must be reassigned or explicitly reviewed for removal first.</p>}
  </details>
  return <details><summary>Evidence and editable geometry</summary>
    <p>{candidate.evidence}</p>{candidate.uncertainties.length > 0 && <ul>{candidate.uncertainties.map((text, i) => <li key={i}>{text}</li>)}</ul>}
    <label>Label<input disabled={disabled} maxLength={200} value={candidate.label || ''} onChange={e => update({ ...candidate, label: e.target.value })} /></label>
    <label>Interpret as<select disabled={disabled || Boolean(candidate.targetId)} value={candidate.kind} onChange={e => update({ ...candidate, kind: e.target.value as Candidate['kind'], curve: ['wall','architectural-boundary'].includes(e.target.value) ? candidate.curve : undefined,
      wallId: ['door', 'window', 'passage'].includes(e.target.value) ? candidate.wallId : undefined })}>
      {['wall', 'door', 'window', 'passage', 'room', 'column', 'stair', 'furniture', 'void', 'architectural-boundary', 'unknown'].map(kind => <option key={kind} value={kind}>{kind==='architectural-boundary'?'Architectural outline':kind}</option>)}
    </select></label>
    <p>Points are percentages across and down the plan, measured from its top-left corner.</p>
    {candidate.points.map((point, index) => <div className="cloud-inline" key={index}>
      <label>Point {index + 1} across %<input type="number" min={0} max={100} step={.1} disabled={disabled} value={Number((point.x * 100).toFixed(3))} onChange={e => update({ ...candidate, points: candidate.points.map((point, i) => i === index ? { ...point, x: Math.max(0, Math.min(1, Number(e.target.value) / 100)) } : point) })} /></label>
      <label>Down %<input type="number" min={0} max={100} step={.1} disabled={disabled} value={Number((point.y * 100).toFixed(3))} onChange={e => update({ ...candidate, points: candidate.points.map((point, i) => i === index ? { ...point, y: Math.max(0, Math.min(1, Number(e.target.value) / 100)) } : point) })} /></label>
    </div>)}
    {['wall', 'door', 'window', 'passage', 'column', 'furniture'].includes(candidate.kind) && <label>Height (metres)<input type="number" min={.01} max={100} step={.05} disabled={disabled} value={candidate.heightMetres ?? ''} onChange={e => update({ ...candidate, heightMetres: e.target.value ? Number(e.target.value) : undefined })} /></label>}
    {candidate.kind === 'wall' && <label>Thickness (% of plan width)<input type="number" min={.001} max={10} step={.01} disabled={disabled} value={Number(((candidate.thickness || .004) * 100).toFixed(3))} onChange={e => update({ ...candidate, thickness: Number(e.target.value) / 100 })} /></label>}
    {['door', 'window', 'passage'].includes(candidate.kind) && <label>Host wall<select disabled={disabled} value={candidate.wallId || ''} onChange={e => update({ ...candidate, wallId: e.target.value || undefined })}>
      <option value="">Choose host wall</option>{walls.map(wall => <option key={wall.id} value={wall.id}>{wall.label || wall.id}</option>)}
    </select></label>}
    {candidate.kind === 'door' && <>
      <label>Door design<select disabled={disabled} value={candidate.doorStyle || 'panel'} onChange={e => update({ ...candidate, doorStyle: e.target.value as Candidate['doorStyle'] })}>
        {['flush', 'panel', 'glazed', 'double','sectional'].map(style => <option key={style}>{style}</option>)}</select></label>
      <label>Hinge<select disabled={disabled} value={candidate.hinge || 'left'} onChange={e => update({ ...candidate, hinge: e.target.value as Candidate['hinge'] })}><option>left</option><option>right</option></select></label>
      <label>Swing<select disabled={disabled} value={candidate.swing || 'in'} onChange={e => update({ ...candidate, swing: e.target.value as Candidate['swing'] })}><option>in</option><option>out</option></select></label>
    </>}
    {candidate.kind === 'column' && <label>Column shape<select disabled={disabled} value={candidate.columnShape || 'rectangular'} onChange={e => update({ ...candidate, columnShape: e.target.value as Candidate['columnShape'] })}><option>rectangular</option><option>circular</option></select></label>}
    {candidate.kind === 'furniture' && <label>Object type<select disabled={disabled} value={candidate.furnitureType || 'unknown'} onChange={e => update({ ...candidate, furnitureType: e.target.value })}>{furnitureTypes.map(type => <option key={type}>{type}</option>)}</select></label>}
    {candidate.kind === 'stair' && <>
      <label>Destination floor<select disabled={disabled} value={candidate.targetLevelId || ''} onChange={e => update({ ...candidate, targetLevelId: e.target.value || undefined })}>
        <option value="">Keep as footprint guide</option>{levels.map(level => <option key={level.id} value={level.id}>{level.name} · {level.elevation} m</option>)}</select></label>
      <label>Flight form<select disabled={disabled} value={candidate.stairForm || 'straight'} onChange={e => update({ ...candidate, stairForm: e.target.value as Candidate['stairForm'] })}><option>straight</option><option>L</option><option>U</option></select></label>
      <label><input type="checkbox" disabled={disabled} checked={candidate.reverse || false} onChange={e => update({ ...candidate, reverse: e.target.checked })} />Reverse ascent direction</label>
    </>}
    {candidate.curve && <p>Curved wall parameters are preserved. Curved openings require manual editing in the main editor.</p>}
  </details>
}
