import type { DesignProposal } from '../../../api/src/contracts/design'
export function DesignReview({ designs, selected, select, disabled }: { designs: DesignProposal[]; selected: Set<string>;
  select: (ids: Set<string>) => void; disabled: boolean }) {
  if (!designs.length) return null
  return <section aria-label="Architecture design alternatives"><h3>Optional architecture design</h3>
    <p>These are inferred design suggestions. Choose the alternatives you want; existing roof and finishes change only when accepted.</p>
    {designs.map(design => <article key={design.id}><label><input type="checkbox" disabled={disabled} checked={selected.has(design.id)} onChange={event => {
      const next = new Set(selected)
      if (event.target.checked) {
        if (design.kind === 'roof') designs.filter(item => item.kind === 'roof').forEach(item => next.delete(item.id))
        if (design.kind !== 'roof') designs.filter(item => item.kind === design.kind && item.entityIds.some(id => design.entityIds.includes(id))).forEach(item => next.delete(item.id))
        next.add(design.id)
      } else next.delete(design.id)
      select(next)
    }} />{design.label} · {design.origin}</label><p>{design.rationale}</p>
      {design.kind === 'roof' ? <p>{design.roof.shape} · {design.roof.material} · pitch {design.roof.pitch}° · overhang {design.roof.overhang} m. Applies to this building’s roof choices.</p>
        : <p>{design.entityIds.length} existing {design.kind === 'glazing' ? `windows · ${design.frame} frames · ${design.glazing} · ${design.type}` : `walls · ${design.material}${design.color ? ` · ${design.color}` : ''}`} affected.</p>}
      {design.uncertainties.map((text, index) => <p key={index}>{text}</p>)}</article>)}
  </section>
}
