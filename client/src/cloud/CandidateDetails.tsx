import type { Candidate } from '../../../api/src/contracts/analysis'
export function CandidateDetails({ candidate, update, disabled, walls }: { candidate: Candidate; update: (candidate: Candidate) => void; disabled: boolean; walls: { id: string; label?: string }[] }) {
  return <details><summary>Evidence and editable geometry</summary>
    <p>{candidate.evidence}</p>{candidate.uncertainties.length > 0 && <ul>{candidate.uncertainties.map((text, i) => <li key={i}>{text}</li>)}</ul>}
    <label>Label<input disabled={disabled} maxLength={200} value={candidate.label || ''} onChange={e => update({ ...candidate, label: e.target.value })} /></label>
    <p>Points are percentages across and down the plan, measured from its top-left corner.</p>
    {candidate.points.map((point, index) => <div className="cloud-inline" key={index}>
      <label>Point {index + 1} across %<input type="number" min={0} max={100} step={.1} disabled={disabled} value={Number((point.x * 100).toFixed(3))} onChange={e => update({ ...candidate, points: candidate.points.map((point, i) => i === index ? { ...point, x: Math.max(0, Math.min(1, Number(e.target.value) / 100)) } : point) })} /></label>
      <label>Down %<input type="number" min={0} max={100} step={.1} disabled={disabled} value={Number((point.y * 100).toFixed(3))} onChange={e => update({ ...candidate, points: candidate.points.map((point, i) => i === index ? { ...point, y: Math.max(0, Math.min(1, Number(e.target.value) / 100)) } : point) })} /></label>
    </div>)}
    {['wall', 'door', 'window', 'column', 'furniture'].includes(candidate.kind) && <label>Height (metres)<input type="number" min={.01} max={100} step={.05} disabled={disabled} value={candidate.heightMetres ?? ''} onChange={e => update({ ...candidate, heightMetres: e.target.value ? Number(e.target.value) : undefined })} /></label>}
    {candidate.kind === 'wall' && <label>Thickness (% of plan width)<input type="number" min={.001} max={10} step={.01} disabled={disabled} value={Number(((candidate.thickness || .004) * 100).toFixed(3))} onChange={e => update({ ...candidate, thickness: Number(e.target.value) / 100 })} /></label>}
    {['door', 'window'].includes(candidate.kind) && <label>Host wall<select disabled={disabled} value={candidate.wallId || ''} onChange={e => update({ ...candidate, wallId: e.target.value || undefined })}>
      <option value="">Choose host wall</option>{walls.map(wall => <option key={wall.id} value={wall.id}>{wall.label || wall.id}</option>)}
    </select></label>}
    {candidate.curve && <p>Curved wall parameters are preserved. Curved openings require manual editing in the main editor.</p>}
  </details>
}
