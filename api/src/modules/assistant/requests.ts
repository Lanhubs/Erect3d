import type { Database } from '../../db/connection'
import type { Config } from '../../config/env'
import type { Actor } from '../auth/session'
import type { z } from 'zod'
import { assistantMessage } from '../../contracts/assistant'
import { authorize } from '../../security/permissions'
import { ApiError } from '../../security/errors'
import { idempotent } from '../../security/idempotency'
import { newId, checksum } from '../../security/tokens'
import { loadDocument } from '../projects/documents'
import { enqueue } from '../../jobs/queue'
import { scopeContext } from './scope'
import { assistantEvent } from './events'
import { assistantModel } from './provider'
import { resolveAssistantFloor } from '../../../../client/src/domain/assistantFloor'
export async function requestAssistant(
  db: Database,
  config: Config,
  actor: Actor,
  projectId: string,
  input: z.infer<typeof assistantMessage>,
  key: string | undefined,
  requestId: string,
) {
  await authorize(db, actor, projectId, 'edit')
  return idempotent(db, actor.id, `assistant:${projectId}`, key, input, async (tx) => {
    const project = await authorize(tx, actor, projectId, 'edit'),
      snapshot = await loadDocument(tx, projectId)
    if (snapshot.revision !== input.baseRevision)
      throw new ApiError(409, 'REVISION_CONFLICT', 'Sync the current model before sending this request')
    const context = scopeContext(snapshot.document, input.scope)
    const target = resolveAssistantFloor(context.building, input.scope, input.message)
    if (target.question) throw new ApiError(422, 'ASSISTANT_TARGET', target.question)
    const scope = { ...input.scope, levelId: target.levelId }
    const { level } = scopeContext(snapshot.document, scope)
    if (level.locked) throw new ApiError(409, 'LEVEL_LOCKED', 'Unlock this floor before requesting changes')
    for (const sourceId of input.planSourceIds) {
      if (scope.mode !== 'building' && sourceId !== level.sourceId)
        throw new ApiError(422, 'ASSISTANT_SOURCE', 'Choose a reference from the selected floor')
      const [source] =
        await tx`SELECT source_id FROM source_plans WHERE project_id=${projectId} AND source_id=${sourceId}`
      if (!source || !snapshot.document.sources.some((s) => s.id === sourceId))
        throw new ApiError(422, 'ASSISTANT_SOURCE', 'Attach a source from this project')
    }
    if (input.previousRunId) {
      const [previous] =
        await tx`SELECT * FROM assistant_runs WHERE id=${input.previousRunId} AND project_id=${projectId} AND actor_id=${actor.id}`
      if (
        !previous ||
        previous.status !== 'ready' ||
        Number(previous.base_revision) !== input.baseRevision ||
        checksum(previous.scope) !== checksum(scope)
      )
        throw new ApiError(409, 'ASSISTANT_STALE', 'The earlier proposal is no longer current')
    }
    const [thread] =
      await tx`INSERT INTO assistant_threads(id,project_id,actor_id) VALUES (${newId('thread')},${projectId},${actor.id})
      ON CONFLICT(project_id,actor_id) DO UPDATE SET project_id=EXCLUDED.project_id RETURNING id`
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${`assistant-thread:${thread.id}`},0))`
    const [active] =
      await tx`SELECT id FROM assistant_runs WHERE thread_id=${thread.id} AND status IN ('queued','running')`
    if (active)
      throw new ApiError(409, 'ASSISTANT_BUSY', 'A request is already running in this project', {
        runId: active.id,
      })
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${`ai-quota:${actor.id}`},0))`
    const [usage] =
      await tx`SELECT count(*)::int AS count FROM ai_usage WHERE actor_id=${actor.id} AND created_at>now()-interval '24 hours'`
    if (usage.count >= config.AI_DAILY_LIMIT)
      throw new ApiError(429, 'AI_QUOTA', 'Your daily design allowance is used')
    const runId = await enqueue(tx, actor, projectId, 'assistant.edit', { ...input, scope }, requestId)
    await tx`UPDATE jobs SET max_attempts=1 WHERE id=${runId}`
    await tx`INSERT INTO assistant_runs(id,thread_id,project_id,actor_id,base_revision,scope,plan_source_ids)
      VALUES (${runId},${thread.id},${projectId},${actor.id},${input.baseRevision},${scope}::jsonb,${input.planSourceIds}::jsonb)`
    await tx`INSERT INTO assistant_messages(thread_id,run_id,role,content) VALUES (${thread.id},${runId},'user',${input.message})`
    await tx`INSERT INTO ai_usage(actor_id,team_id,project_id,job_id,model,kind) VALUES (${actor.id},${project.team_id},${projectId},${runId},${assistantModel(config)},'assistant.edit')`
    await assistantEvent(tx, projectId, actor.id, runId, 'Waiting to start', 'queued')
    return { runId }
  })
}
