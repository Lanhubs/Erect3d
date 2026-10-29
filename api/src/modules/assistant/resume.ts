import type { Database } from '../../db/connection'
import type { EditWorkspace } from './edits'
import { ApiError } from '../../security/errors'

export async function resumeAssistantProposal(
  db: Database,
  work: EditWorkspace,
  run: any,
  previousId: string,
) {
  const [previous] =
    await db`SELECT proposal FROM assistant_runs WHERE id=${previousId} AND project_id=${run.project_id} AND actor_id=${run.actor_id} AND base_revision=${run.base_revision} AND status='ready'`
  if (!previous?.proposal)
    throw new ApiError(409, 'ASSISTANT_STALE', 'The earlier proposal is no longer available')
  work.document = structuredClone(previous.proposal.document)
  work.descriptions = [...previous.proposal.descriptions]
  work.focusLevelId = previous.proposal.focusLevelId
  if (work.focusLevelId) work.scope.levelId = work.focusLevelId
  for (const id of previous.proposal.allowedIds || []) work.allowed.add(id)
}
