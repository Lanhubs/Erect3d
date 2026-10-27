import type { AssistantRun } from './assistantTypes'

type Input = { message: string; baseRevision: number }
type Delivery = { input: Input; id: string }
// An ambiguous transport failure reuses its key. A known terminal run is a new user attempt.
export function assistantRequestId(
  input: Input,
  cached: Delivery | null | undefined,
  run: AssistantRun | null,
  lastMessage?: string,
) {
  const same = JSON.stringify(cached?.input) === JSON.stringify(input)
  const finished =
    run &&
    !['queued', 'running', 'ready'].includes(run.status) &&
    run.base_revision === input.baseRevision &&
    lastMessage === input.message
  return same && !finished ? cached!.id : crypto.randomUUID()
}
