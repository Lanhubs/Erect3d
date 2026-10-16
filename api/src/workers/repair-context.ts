import type {Candidate,Intelligence} from '../contracts/analysis'
import type {IntelligenceInput} from '../modules/ai/provider'
import type {ModelQuality} from '../modules/plan-analysis/quality'
export const needsSourceRepair=(quality:ModelQuality)=>quality.status==='blocked'||quality.issues.some(issue=>['NO_WINDOWS','NO_DOORS'].includes(issue.code))
// Repairs are sparse edits. Limit context to failed entities, their hosts and
// nearby source geometry instead of asking the provider to redraw the building.
export function repairContext(source:IntelligenceInput,proposal:Intelligence,quality:ModelQuality):IntelligenceInput{
  const coverage=quality.issues.some(issue=>['NO_WINDOWS','NO_DOORS'].includes(issue.code))
  const failed=new Set(quality.issues.filter(issue=>issue.severity==='error').map(issue=>issue.candidateId).filter(Boolean))
  const targets=proposal.candidates.filter(candidate=>failed.has(candidate.id))
  const anchors=targets.flatMap(candidate=>candidate.points)
  const hosts=new Set(targets.map(candidate=>candidate.wallId).filter(Boolean))
  const distance=(candidate:Candidate)=>Math.min(Infinity,...candidate.points.flatMap(point=>anchors.map(anchor=>Math.hypot(point.x-anchor.x,point.y-anchor.y))))
  const nearby=proposal.candidates.filter(candidate=>!failed.has(candidate.id))
    .sort((a,b)=>Number(hosts.has(b.id))-Number(hosts.has(a.id)) || distance(a)-distance(b)).slice(0,80)
  const needsDocument=quality.issues.some(issue=>issue.severity==='error'&&/ARCHITECTURE|HEIGHT|FLOOR_DIMENSION/.test(issue.code))
  return {...source,document:needsDocument?source.document:undefined,designReference:undefined,candidates:[...targets,...nearby],understanding:proposal.understanding,architecturalRequirements:proposal.architecturalRequirements,
    details:coverage?source.details:source.details?.filter(detail=>anchors.some(anchor=>anchor.x>=detail.region.x && anchor.y>=detail.region.y && anchor.x<=detail.region.x+detail.region.width && anchor.y<=detail.region.y+detail.region.height)),
    validationIssues:[...quality.issues.filter(issue=>issue.severity==='error'||['NO_WINDOWS','NO_DOORS'].includes(issue.code)).map(issue=>`${issue.code}: ${issue.message}`),
      ...(coverage?['Inspect every exterior wall span for window/frame marks (including W labels) and real entrance gaps. Return all depicted missing windows/doors with exact existing wallId hosts and two points along each gap. Add a host only where source ink establishes one. Preserve existing geometry. If the drawing genuinely has no such openings, explain the source evidence in warnings; never invent openings to satisfy a count.']:[])]}
}
