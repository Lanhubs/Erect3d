import type { Candidate, Intelligence } from '../../contracts/analysis'
import { ProviderFailure } from './provider'
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)
export function reconcile(deterministic: Candidate[], proposals: Intelligence[], mode: string): Intelligence {
  const map = new Map<string, Candidate>()
  const warnings: string[] = []
  for (const candidate of [...deterministic, ...proposals.flatMap(item => item.candidates)]) {
    if (candidate.kind === 'furniture' && !['furniture', 'full', 'fixtures'].includes(mode)) continue
    if (['wall', 'door', 'window'].includes(candidate.kind) && (candidate.points.length < 2 || distance(candidate.points[0], candidate.points.at(-1)!) < .0001)) {
      warnings.push(`Degenerate ${candidate.kind} candidate ${candidate.id} excluded`)
      continue
    }
    if (['room', 'void', 'column'].includes(candidate.kind) && candidate.points.length < 3) {
      warnings.push(`Incomplete polygon ${candidate.id} requires manual interpretation`)
      continue
    }
    if (candidate.kind === 'wall' && !candidate.curve) {
      const duplicate = [...map.values()].find(item => item.kind === 'wall' && !item.curve &&
        Math.min(distance(item.points[0], candidate.points[0]) + distance(item.points.at(-1)!, candidate.points.at(-1)!),
          distance(item.points[0], candidate.points.at(-1)!) + distance(item.points.at(-1)!, candidate.points[0])) < .003)
      if (duplicate && duplicate.id !== candidate.id) { warnings.push(`Duplicate wall ${candidate.id} excluded; review ${duplicate.id}`); continue }
    }
    map.set(candidate.id, candidate)
  }
  const ids = new Set(map.keys())
  for (const candidate of map.values()) {
    if (candidate.wallId && !ids.has(candidate.wallId)) throw new ProviderFailure('AI_INVALID_HOST', false)
  }
  if (map.size > 2000) throw new ProviderFailure('AI_TOO_MANY_CANDIDATES', false)
  return { coordinatesVersion: 1, coordinateSystem: 'normalized-image-top-left', candidates: [...map.values()],
    warnings: [...warnings, ...proposals.flatMap(item => item.warnings)].slice(0,100) }
}
export function analysisPasses(mode: string, complex: boolean) {
  const passes = ['structure', 'openings']
  if (mode !== 'structure') passes.push('rooms-labels')
  if (['fixtures', 'furniture', 'full'].includes(mode)) passes.push(mode === 'fixtures' ? 'fixtures' : 'furniture-fixtures')
  if (complex) passes.push('complex-validation')
  return passes
}
