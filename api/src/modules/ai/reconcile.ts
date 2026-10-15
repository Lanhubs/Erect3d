import type { Candidate, Intelligence } from '../../contracts/analysis'
import { ProviderFailure } from './provider'
import { checkCandidate, type ImageScale } from './candidateChecks'
import {sameWallBand}from'./wall-band'
export { analysisPasses } from './passes'
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)
export function reconcile(deterministic: Candidate[], proposals: Intelligence[], mode: string, scale?: ImageScale, currentModel: Candidate[] = []): Intelligence {
  const map = new Map<string, Candidate>()
  const aliases = new Map<string, string>()
  const warnings: string[] = []
  const decisions = new Map(proposals.flatMap(item => item.dispositions || []).map(item => [item.candidateId, item]))
  const latest = new Map([...deterministic, ...proposals.flatMap(item => item.candidates)].filter(candidate => decisions.get(candidate.id)?.decision !== 'reject').map(candidate => [candidate.id, candidate]))
  for (const item of decisions.values()) if (item.decision === 'reject') warnings.push(`Excluded ${item.candidateId}: ${item.reason}`)
  for (const raw of latest.values()) {
    const candidate = checkCandidate(raw, scale)
    if(candidate.kind==='furniture' && candidate.furnitureType==='table') {
      candidate.furnitureType='dining-table'
      candidate.uncertainties=[...candidate.uncertainties,'Generic table mapped to the editable table asset; verify its shape and finish'].slice(0,20)
    }
    if (candidate.kind === 'furniture' && !['furniture', 'full', 'fixtures'].includes(mode)) continue
    if (['wall', 'door', 'window', 'passage'].includes(candidate.kind) && (candidate.points.length < 2 || distance(candidate.points[0], candidate.points.at(-1)!) < .0001)) {
      warnings.push(`Degenerate ${candidate.kind} candidate ${candidate.id} excluded`)
      continue
    }
    if (['room', 'void', 'column'].includes(candidate.kind) && candidate.points.length < 3) {
      warnings.push(`Incomplete polygon ${candidate.id} requires manual interpretation`)
      continue
    }
    if (candidate.kind === 'wall' && !candidate.curve) {
      const duplicate = [...map.values()].find(item => item.kind === 'wall' && !item.curve &&
        (sameWallBand(item,candidate,scale) || Math.min(distance(item.points[0], candidate.points[0]) + distance(item.points.at(-1)!, candidate.points.at(-1)!),
          distance(item.points[0], candidate.points.at(-1)!) + distance(item.points.at(-1)!, candidate.points[0])) < .003))
      if (duplicate && duplicate.id !== candidate.id) {
        aliases.set(candidate.id, duplicate.id)
        warnings.push(`Duplicate wall ${candidate.id} excluded; review ${duplicate.id}`); continue
      }
    }
    map.set(candidate.id, candidate)
  }
  const ids = new Set(map.keys())
  for (const candidate of map.values()) {
    if (candidate.wallId && aliases.has(candidate.wallId)) candidate.wallId = aliases.get(candidate.wallId)
    if (candidate.wallId && (!ids.has(candidate.wallId) || map.get(candidate.wallId)?.kind !== 'wall') && !currentModel.some(item => item.kind === 'wall' && item.targetId === candidate.wallId)) {
      candidate.uncertainties = [...candidate.uncertainties, 'Host wall is missing; choose a valid wall before acceptance'].slice(0,20)
      delete candidate.wallId; candidate.confidence = Math.min(candidate.confidence, .35)
    }
  }
  if (map.size > 2000) throw new ProviderFailure('AI_TOO_MANY_CANDIDATES', false)
  return { coordinatesVersion: 1, coordinateSystem: 'normalized-image-top-left', candidates: [...map.values()],
    warnings: [...warnings, ...proposals.flatMap(item => item.warnings)].slice(0,100),
    understanding: proposals.find(item => item.understanding)?.understanding,
    architecturalRequirements:proposals.find(item=>item.architecturalRequirements)?.architecturalRequirements,
    vision:proposals.find(item=>item.vision)?.vision,
    dispositions:[...decisions.values()].slice(0,2000),
    designs: proposals.flatMap(item => item.designs || []).slice(0,20) }
}
