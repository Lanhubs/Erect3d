import type { Database } from '../../db/connection'
import type { Actor } from '../auth/session'
import type { Config } from '../../config/env'
import { authorize } from '../../security/permissions'
import { ApiError } from '../../security/errors'
import { commitInTransaction } from '../projects/operations'
import { assistantEvent } from './events'
export async function ownedRun(db: Database, actor: Actor, projectId: string, id: string) {
  await authorize(db, actor, projectId)
  const [run] =
    await db`SELECT * FROM assistant_runs WHERE id=${id} AND project_id=${projectId} AND actor_id=${actor.id}`
  if (!run) throw new ApiError(404, 'NOT_FOUND', 'Conversation request not found')
  return run
}
export async function applyAssistant(
  db: Database,
  config: Config,
  actor: Actor,
  projectId: string,
  id: string,
  input: { operationId: string; baseRevision: number },
) {
  return db.begin(async (tx) => {
    await tx`SELECT id FROM projects WHERE id=${projectId} FOR UPDATE`
    const project = await authorize(tx, actor, projectId, 'edit'),
      run = await ownedRun(tx, actor, projectId, id)
    if (run.status === 'applied') {
      if (run.applied_operation_id !== input.operationId)
        throw new ApiError(409, 'ASSISTANT_APPLIED', 'This proposal was already applied')
      return { revision: Number(run.applied_revision), operationId: input.operationId }
    }
    if (run.status !== 'ready' || !run.proposal)
      throw new ApiError(409, 'ASSISTANT_STATE', 'Choose a completed, validated proposal')
    if (Number(run.base_revision) !== input.baseRevision || Number(project.revision) !== input.baseRevision)
      throw new ApiError(409, 'ASSISTANT_STALE', 'The model changed. Prepare a new proposal before applying.')
    const accepted = await commitInTransaction(tx, config, actor, projectId, {
      operationId: input.operationId,
      baseRevision: input.baseRevision,
      type: 'document.patch',
      entityId: run.scope.entityId || run.scope.levelId,
      payload: { changes: run.proposal.changes },
    })
    await tx`UPDATE assistant_runs SET status='applied',progress='Changes applied',applied_operation_id=${input.operationId},applied_revision=${accepted.revision} WHERE id=${id}`
    await assistantEvent(tx, projectId, actor.id, id, 'Changes applied', 'applied')
    return { revision: accepted.revision, operationId: input.operationId }
  })
}
export async function cancelAssistant(db: Database, actor: Actor, projectId: string, id: string) {
  await authorize(db, actor, projectId, 'edit')
  return db.begin(async (tx) => {
    await tx`SELECT id FROM projects WHERE id=${projectId} FOR UPDATE`
    const run = await ownedRun(tx, actor, projectId, id)
    if (run.status === 'applied')
      throw new ApiError(409, 'ASSISTANT_APPLIED', 'Use Undo to revert applied changes')
    const status = run.status === 'ready' ? 'discarded' : 'cancelled'
    await tx`UPDATE assistant_runs SET status=${status},progress=${status === 'discarded' ? 'Proposal discarded' : 'Request cancelled'} WHERE id=${id} AND status<>'applied'`
    await tx`UPDATE jobs SET status='cancelled',completed_at=now() WHERE id=${id} AND status IN ('queued','running')`
    await assistantEvent(
      tx,
      projectId,
      actor.id,
      id,
      status === 'discarded' ? 'Proposal discarded' : 'Request cancelled',
      status,
    )
    return { status }
  })
}
