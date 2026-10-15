import type {Candidate,Intelligence} from '../contracts/analysis'
import type {IntelligenceInput} from '../modules/ai/provider'
import type {ModelQuality} from '../modules/plan-analysis/quality'
// Repairs are sparse edits. Limit context to failed entities, their hosts and
// nearby source geometry instead of asking the provider to redraw the building.
export function repairContext(source:IntelligenceInput,proposal:Intelligence,quality:ModelQuality):IntelligenceInput{
  const failed=new Set(quality.issues.filter(issue=>issue.severity==='error').map(issue=>issue.candidateId).filter(Boolean))
  const targets=proposal.candidates.filter(candidate=>failed.has(candidate.id))
  const anchors=targets.flatMap(candidate=>candidate.points)
  const hosts=new Set(targets.map(candidate=>candidate.wallId).filter(Boolean))
  const distance=(candidate:Candidate)=>Math.min(Infinity,...candidate.points.flatMap(point=>anchors.map(anchor=>Math.hypot(point.x-anchor.x,point.y-anchor.y))))
  const nearby=proposal.candidates.filter(candidate=>!failed.has(candidate.id))
    .sort((a,b)=>Number(hosts.has(b.id))-Number(hosts.has(a.id)) || distance(a)-distance(b)).slice(0,80)
  return {...source,candidates:[...targets,...nearby],understanding:proposal.understanding,
    details:source.details?.filter(detail=>anchors.some(anchor=>anchor.x>=detail.region.x && anchor.y>=detail.region.y && anchor.x<=detail.region.x+detail.region.width && anchor.y<=detail.region.y+detail.region.height)),
    validationIssues:quality.issues.filter(issue=>issue.severity==='error').map(issue=>`${issue.code}: ${issue.message}`)}
}
