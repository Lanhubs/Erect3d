import type { Candidate, Intelligence } from '../../contracts/analysis'
import { ProviderFailure } from './provider'
import { checkCandidate, type ImageScale } from './candidateChecks'
import {sameWallBand,mergeWallBand}from'./wall-band'
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
      const duplicates = [...map.values()].filter(item => item.kind === 'wall' && !item.curve && item.points.length===2&&candidate.points.length===2 && (!item.targetId||!candidate.targetId||item.targetId===candidate.targetId) &&
        (sameWallBand(item,candidate,scale) || Math.min(distance(item.points[0], candidate.points[0]) + distance(item.points.at(-1)!, candidate.points.at(-1)!),
          distance(item.points[0], candidate.points.at(-1)!) + distance(item.points.at(-1)!, candidate.points[0])) < .003))
      if (duplicates.length) {
        const canonical=duplicates[0]
        // A short measured fragment must never replace its complete source wall:
        // hosted doors may sit elsewhere along that same continuous band.
        map.set(canonical.id,checkCandidate(mergeWallBand([...duplicates,candidate],canonical.id,scale),scale))
        for(const duplicate of [...duplicates,candidate])if(duplicate.id!==canonical.id){aliases.set(duplicate.id,canonical.id);map.delete(duplicate.id)}
        warnings.push(`Overlapping wall evidence consolidated into ${canonical.id}; its complete source span was retained`); continue
      }
    }
    map.set(candidate.id, candidate)
  }
  const ids = new Set(map.keys())
  const resolve=(id:string)=>{const seen=new Set<string>();while(aliases.has(id)&&!seen.has(id)){seen.add(id);id=aliases.get(id)!}return id}
  for (const candidate of map.values()) {
    if (candidate.wallId) candidate.wallId = resolve(candidate.wallId)
    if (candidate.wallId && (!ids.has(candidate.wallId) || map.get(candidate.wallId)?.kind !== 'wall') && !currentModel.some(item => item.kind === 'wall' && item.targetId === candidate.wallId)) {
      candidate.uncertainties = [...candidate.uncertainties, 'Host wall is missing; choose a valid wall before acceptance'].slice(0,20)
      delete candidate.wallId; candidate.confidence = Math.min(candidate.confidence, .35)
    }
  }
  if (map.size > 2000) throw new ProviderFailure('AI_TOO_MANY_CANDIDATES', false)
  return { coordinatesVersion: 1, coordinateSystem: 'normalized-image-top-left', candidates: [...map.values()],
    warnings: [...warnings, ...proposals.flatMap(item => item.warnings)].slice(0,100),
    understanding: proposals.find(item => item.understanding)?.understanding,
    architecturalRequirements:proposals.some(item=>item.architecturalRequirements)?{
      typology:proposals.find(item=>item.architecturalRequirements?.typology!=='unknown'&&item.architecturalRequirements)?.architecturalRequirements?.typology||'unknown',
      systems:[...new Map(proposals.flatMap(item=>item.architecturalRequirements?.systems||[]).map(system=>[system.id,{...system,
        ...(system.boundaryId?{boundaryId:resolve(system.boundaryId)}:{})}])).values()],
    }:undefined,
    vision:proposals.find(item=>item.vision)?.vision,
    dispositions:[...decisions.values()].slice(0,2000),
    designs: proposals.flatMap(item => item.designs || []).slice(0,20) }
}
