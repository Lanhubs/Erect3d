import type { AssistantRun } from './assistantTypes'

// A clear approval acts on the reviewed proposal; it is not another model request.
export function approvesAssistantProposal(message: string, run: AssistantRun | null) {
  return Boolean(
    run?.status === 'ready' &&
    run.proposal &&
    /^(?:yes[,!]?\s*)?(?:proceed|apply(?:\s+(?:it|this|the\s+(?:proposal|changes)))?|go ahead|do it|yes)[.!\s]*$/i.test(
      message.trim(),
    ),
  )
}
