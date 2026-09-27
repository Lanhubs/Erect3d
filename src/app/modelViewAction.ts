import type { AnalysisStatus } from '../features/import/useAnalysis'

export function modelViewAction(status: AnalysisStatus, candidates: number, walls: number, hasSource: boolean) {
  if (status === 'completed' && candidates > 0) return 'build' as const
  if (hasSource && walls === 0) return ['preparing', 'analyzing', 'building'].includes(status) ? 'wait' as const : 'analyze' as const
  return 'show' as const
}
