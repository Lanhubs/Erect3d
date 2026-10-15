import type { Candidate, Intelligence } from '../../contracts/analysis'
const gap = (a: Candidate, b: Candidate) => {
  if (a.points.length !== b.points.length) return Infinity
  const distance = (reverse: boolean) => a.points.reduce((sum, p, i) => {
    const q = b.points[reverse ? b.points.length - i - 1 : i]
    return sum + Math.hypot(p.x - q.x, p.y - q.y)
  }, 0) / a.points.length
  return Math.min(distance(false), distance(true))
}
export function enhanceProposal(proposal: Intelligence, current: Candidate[]): Intelligence {
  const aliases = new Map<string, string>(), warnings = [...proposal.warnings]
  const candidates = proposal.candidates.flatMap(candidate => {
    const existing = candidate.targetId ? current.find(item => item.targetId === candidate.targetId && item.kind === candidate.kind)
      : current.find(item => item.kind === candidate.kind && Boolean(item.curve) === Boolean(candidate.curve) && gap(item, candidate) < .012)
    if (!existing) {
      if (candidate.targetId) { warnings.push(`Correction ${candidate.id} has an unknown target; excluded`); return [] }
      return [candidate]
    }
    aliases.set(candidate.id, existing.targetId!)
    const differs = gap(candidate, existing) > .0001 || ['thickness','heightMetres','label','doorStyle','hinge','swing','columnShape','curve','wallKind','windowType','sillMetres'].some(key => {
      const field = key as keyof Candidate
      return candidate[field] !== undefined && JSON.stringify(candidate[field]) !== JSON.stringify(existing[field])
    })
    if (!differs) return []
    return [{ ...candidate, targetId: existing.targetId, confirmedFields: existing.confirmedFields }]
  })
  for (const candidate of candidates) if (candidate.wallId && aliases.has(candidate.wallId)) candidate.wallId = aliases.get(candidate.wallId)
  const removals:Candidate[]=[]
  for (const decision of proposal.dispositions || []) {
    if (decision.decision !== 'reject') continue
    const existing=current.find(item=>item.targetId===decision.candidateId)
    if (!existing || !['wall','door','window','passage','room','column'].includes(existing.kind)) continue
    removals.push({ ...existing,id:existing.targetId!,action:'remove',evidence:decision.reason,
      confidence:.5,uncertainties:['Verify this element against the source before removing it.'],needsReview:true })
  }
  const removed=new Set(removals.map(item=>item.targetId))
  return { ...proposal,candidates:[...candidates.filter(item=>!removed.has(item.targetId)),...removals].slice(0,2000),warnings:warnings.slice(0,100) }
}
