import type { Database } from '../../db/connection'
import type { Config } from '../../config/env'
import type { Actor } from '../auth/session'
import type { Operation } from '../../contracts/operations'
import { projectSchema } from '../../contracts/project'
import { parse } from '../../contracts/http'
import { checksum } from '../../security/tokens'
import { ApiError } from '../../security/errors'
import { authorize } from '../../security/permissions'
import { emit } from '../audit/service'
import { applyChanges } from './patch'
import { loadDocument, saveSnapshot } from './documents'
import { validateGeometry } from './geometry-validation'
import { validateLockedLevels } from './locked-levels'
import { validateDocumentSize } from './size'
import { changeEntityIds } from './change-locks'

export async function commitOperation(
  db: Database,
  config: Config,
  actor: Actor,
  projectId: string,
  operation: Operation,
) {
  return db.begin(async (tx) => commitInTransaction(tx, config, actor, projectId, operation))
}
export async function commitInTransaction(
  tx: Database,
  config: Config,
  actor: Actor,
  projectId: string,
  operation: Operation,
) {
  await tx`SELECT id FROM projects WHERE id=${projectId} FOR UPDATE`
  const project = await authorize(tx, actor, projectId, 'edit')
  const hash = checksum(operation)
  const [previous] =
    await tx`SELECT * FROM operations WHERE project_id=${projectId} AND operation_id=${operation.operationId}`
  if (previous) {
    if (previous.request_hash !== hash || previous.actor_id !== actor.id)
      throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'Operation ID was used for different work')
    return {
      ...operation,
      revision: Number(previous.revision),
      actorId: actor.id,
      modifiedAt: previous.payload.modifiedAt,
    }
  }
  if (Number(project.revision) !== operation.baseRevision)
    throw new ApiError(409, 'REVISION_CONFLICT', 'Reload newer changes before applying this edit', {
      revision: Number(project.revision),
    })
  const current = await loadDocument(tx, projectId)
  const ids = changeEntityIds(current.document, operation.payload.changes)
  const locks = await tx`SELECT entity_id FROM entity_locks WHERE project_id=${projectId}
    AND user_id<>${actor.id} AND expires_at>now() AND entity_id=ANY(${tx.array(ids, 'TEXT')})`
  if (locks.length) throw new ApiError(409, 'ENTITY_LOCKED', 'Another collaborator is editing this entity')
  const modifiedAt = Date.now(),
    revision = operation.baseRevision + 1
  const document = parse(projectSchema, applyChanges(current.document, operation.payload.changes, modifiedAt))
  validateDocumentSize(document, config.MAX_PROJECT_BYTES)
  validateLockedLevels(current.document, document)
  validateGeometry(document)
  const payload = { ...operation.payload, modifiedAt }
  await tx`INSERT INTO operations(project_id,revision,operation_id,actor_id,base_revision,type,entity_id,payload,request_hash)
    VALUES (${projectId},${revision},${operation.operationId},${actor.id},${operation.baseRevision},${operation.type},${operation.entityId},${payload}::jsonb,${hash})`
  await tx`UPDATE projects SET revision=${revision},name=${document.name},modified_at=now() WHERE id=${projectId}`
  if (
    revision % config.SNAPSHOT_INTERVAL === 0 ||
    Date.now() - new Date(current.createdAt).getTime() > 300000
  ) {
    await saveSnapshot(tx, projectId, revision, document)
  }
  const accepted = { ...operation, revision, actorId: actor.id, modifiedAt }
  await emit(tx, projectId, 'operation.accepted', accepted)
  return accepted
}
