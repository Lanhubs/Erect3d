import type { Intelligence, Candidate } from '../../contracts/analysis'
export type IntelligenceInput = { bytes: Uint8Array; mime: string; width: number; height: number;
  candidates: Candidate[]; pass: string; region?: { x: number; y: number; width: number; height: number }; model: string }
export type IntelligenceResult = { proposal: Intelligence; usage?: Record<string, number | undefined> }
export interface PlanIntelligenceProvider {
  interpret(input: IntelligenceInput, signal: AbortSignal): Promise<IntelligenceResult>
}
export class ProviderFailure extends Error {
  constructor(public code: string, public retryable: boolean) { super(code) }
}
export function classifyFailure(error: unknown) {
  if (error instanceof ProviderFailure) return error
  const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 0
  if (status === 429) return new ProviderFailure('AI_QUOTA', true)
  if (status >= 500) return new ProviderFailure('AI_UPSTREAM', true)
  if (status >= 400) return new ProviderFailure('AI_REQUEST_REJECTED', false)
  if (error instanceof Error && ['AbortError','TimeoutError'].includes(error.name)) return new ProviderFailure('AI_TIMEOUT', true)
  return new ProviderFailure('AI_NETWORK', true)
}
