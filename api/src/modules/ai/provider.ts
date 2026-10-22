import type { Intelligence, Candidate } from '../../contracts/analysis'
export type IntelligenceInput = {
  bytes: Uint8Array; mime: string; width: number; height: number;
  candidates: Candidate[]; pass: string; region?: { x: number; y: number; width: number; height: number }; model: string;
  calibration?: { metresPerPixel: number; method?: string }; understanding?: Intelligence['understanding'];
  currentModel?: Candidate[]; purpose?: 'interpret' | 'enhance' | 'rebuild'; engine?: 'backend' | 'hybrid';
  document?: { bytes: Uint8Array; mime: 'application/pdf'; page: number }; details?: { bytes: Uint8Array; mime: string; region: { x: number; y: number; width: number; height: number } }[];
  validationIssues?: string[]; architecturalRequirements?: Intelligence['architecturalRequirements'];
  designMode?: 'faithful' | 'creative';
  designReference?: { bytes: Uint8Array; mime: string };
  crop?: { bytes: Uint8Array; mime: string }
}
export type IntelligenceResult = { proposal: Intelligence; usage?: Record<string, number | undefined> }
export interface PlanIntelligenceProvider {
  interpret(input: IntelligenceInput, signal: AbortSignal): Promise<IntelligenceResult>
}
export class ProviderFailure extends Error {
  constructor(public code: string, public retryable: boolean, public upstreamStatus?: number, public schemaIssues?: string[]) { super(code) }
}
export function classifyFailure(error: unknown) {
  if (error instanceof ProviderFailure) return error
  const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 0
  if (status === 429) return new ProviderFailure('AI_QUOTA', true)
  if (status >= 500) return new ProviderFailure('AI_UPSTREAM', true)
  if (status >= 400) {
    const message = error instanceof Error ? error.message.toLowerCase() : ''
    const code = status === 401 || status === 403 || /api key not valid|api key expired|invalid api key/.test(message) ? 'AI_AUTH_FAILED'
      : status === 404 ? 'AI_MODEL_UNAVAILABLE' : /schema|response_json_schema|response schema/.test(message) ? 'AI_SCHEMA_REJECTED' : 'AI_REQUEST_REJECTED'
    return new ProviderFailure(code, false, status)
  }
  if (error instanceof Error) {
    const name = error.name || ''
    const message = error.message || ''
    const cause = (error as any).cause
    const causeName = cause instanceof Error ? cause.name : ''
    const causeMsg = cause instanceof Error ? cause.message : (typeof cause === 'string' ? cause : '')
    if (['AbortError', 'TimeoutError'].includes(name) || ['AbortError', 'TimeoutError'].includes(causeName) ||
      /abort|timeout|timed\s*out/i.test(message) || /abort|timeout|timed\s*out/i.test(causeMsg)) {
      return new ProviderFailure('AI_TIMEOUT', true)
    }
    if (/fetch|network|socket|connect|enotfound|eai_again|econnreset|etimedout|ehostunreach|econnrefused|unable to connect|getaddrinfo|tls|ssl|failed to fetch/i.test(message) ||
      /fetch|network|socket|connect|enotfound|eai_again|econnreset|etimedout|ehostunreach|econnrefused|unable to connect|getaddrinfo|tls|ssl|failed to fetch/i.test(causeMsg) ||
      (error.stack && /node_modules[\\/]@google[\\/]genai[\\/]dist[\\/].*?index\.(?:mjs|cjs):\d+:\d+/.test(error.stack))) {
      return new ProviderFailure('AI_NETWORK', true)
    }
  }
  if (error instanceof TypeError && !/fetch|network|socket|connect/i.test(error.message)) return new ProviderFailure('AI_CLIENT_ERROR', false)
  return new ProviderFailure('AI_NETWORK', true)
}
