import { ApiError } from '../../security/errors'
import { ProviderFailure } from '../ai/provider'

const messages: Record<string, string> = {
  AI_NETWORK: 'The connection to Gemini was interrupted. Retry your request; no changes were applied.',
  AI_TIMEOUT: 'Gemini did not respond in time. Retry with a smaller change; no changes were applied.',
  AI_QUOTA: 'Gemini’s rate or billing limit was reached. Check the API quota before retrying.',
  AI_AUTH_FAILED: 'Gemini rejected the server’s API credentials. Check the configured API key.',
  AI_MODEL_UNAVAILABLE:
    'The configured Assistant model is unavailable to this API key. Check GEMINI_MODEL_AGENT and model access.',
  AI_SCHEMA_REJECTED: 'Gemini rejected the editing tool definitions. The server integration needs attention.',
  AI_REQUEST_REJECTED:
    'Gemini rejected the editing request. Check the server’s Assistant model configuration.',
  AI_UPSTREAM: 'Gemini is temporarily unavailable. Retry your request; no changes were applied.',
  AI_RESPONSE_EMPTY: 'Gemini returned no usable edits or explanation. Retry your request.',
  AI_RESPONSE_LIMIT: 'Gemini reached its response limit. Request a smaller group of changes.',
  ASSISTANT_TIMEOUT: 'This request took too long. Try a smaller change.',
  ASSISTANT_CANCELLED: 'Request cancelled. No changes were applied.',
}
export function assistantFailure(error: unknown, timeout = false, cancelled = false) {
  const code = timeout
    ? 'ASSISTANT_TIMEOUT'
    : cancelled
      ? 'ASSISTANT_CANCELLED'
      : error instanceof ApiError || error instanceof ProviderFailure
        ? error.code
        : 'ASSISTANT_FAILED'
  return {
    code,
    message:
      messages[code] ||
      (error instanceof ApiError
        ? error.message
        : 'The request could not be completed. Your model is unchanged.'),
  }
}
export function assistantJobFailure(code: string) {
  return messages[code] || 'The request stopped before a proposal was ready. Retry your request.'
}
