import type { Database } from '../../db/connection'
import type { Actor } from '../auth/session'
import { authorize } from '../../security/permissions'
import { ApiError, requireValue } from '../../security/errors'
import { checksum, newId } from '../../security/tokens'
import { audit, emit } from '../audit/service'
import { loadDocument, saveSnapshot } from '../projects/documents'
import { validateDocumentSize } from '../projects/size'

export async function createVersion(
  db: Database,
  actor: Actor,
  projectId: string,
  name: string,
  requestId: string,
) {
  return db.begin(async (tx) => {
    await tx`SELECT id FROM projects WHERE id=${projectId} FOR UPDATE`
    await authorize(tx, actor, projectId, 'edit')
    const current = await loadDocument(tx, projectId)
    await saveSnapshot(tx, projectId, current.revision, current.document)
    const id = newId('version')
    const [version] = await tx`INSERT INTO versions(id,project_id,revision,name,actor_id)
      VALUES (${id},${projectId},${current.revision},${name},${actor.id}) RETURNING *`
    await audit(tx, actor, projectId, 'version.created', requestId, { versionId: id })
    await emit(tx, projectId, 'revision.created', { versionId: id, revision: current.revision, name })
    return version
  })
}
export async function restoreVersion(
  db: Database,
  actor: Actor,
  projectId: string,
  versionId: string,
  operationId: string,
  baseRevision: number,
  requestId: string,
  maximumBytes = 33554432,
) {
  return db.begin(async (tx) => {
    await tx`SELECT id FROM projects WHERE id=${projectId} FOR UPDATE`
    const project = await authorize(tx, actor, projectId, 'manage')
    const hash = checksum({ versionId, operationId, baseRevision })
    const [previous] =
      await tx`SELECT revision,request_hash,actor_id FROM operations WHERE project_id=${projectId} AND operation_id=${operationId}`
    if (previous) {
      if (previous.request_hash !== hash || previous.actor_id !== actor.id)
        throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'Operation ID already used')
      return { revision: Number(previous.revision) }
    }
    if (Number(project.revision) !== baseRevision)
      throw new ApiError(409, 'REVISION_CONFLICT', 'Reload newer changes')
    const [version] =
      await tx`SELECT revision FROM versions WHERE id=${versionId} AND project_id=${projectId}`
    requireValue(version)
    const source = await loadDocument(tx, projectId, Number(version.revision))
    validateDocumentSize(source.document, maximumBytes)
    source.document.modified = Date.now()
    const next = baseRevision + 1
    await tx`INSERT INTO operations(project_id,revision,operation_id,actor_id,base_revision,type,entity_id,payload,request_hash)
      VALUES (${projectId},${next},${operationId},${actor.id},${baseRevision},'document.restore',${projectId},
        ${{ document: source.document, versionId }}::jsonb,${hash})`
    await tx`UPDATE projects SET revision=${next},name=${source.document.name},modified_at=now() WHERE id=${projectId}`
    await saveSnapshot(tx, projectId, next, source.document)
    await audit(tx, actor, projectId, 'version.restored', requestId, { versionId, revision: next })
    await emit(tx, projectId, 'revision.restored', { revision: next, versionId })
    return { revision: next }
  })
}
export function compareDocuments(left: unknown, right: unknown) {
  function entities(document: unknown) {
    const result = new Map<string, string>()
    function walk(value: unknown) {
      if (Array.isArray(value)) {
        value.forEach(walk)
        return
      }
      if (!value || typeof value !== 'object') return
      if ('id' in value && typeof value.id === 'string') {
        const own = Object.fromEntries(
          Object.entries(value).filter(
            ([, item]) =>
              !Array.isArray(item) ||
              !item.every((child) => child && typeof child === 'object' && 'id' in child),
          ),
        )
        result.set(value.id, checksum(own))
      }
      Object.values(value).forEach(walk)
    }
    walk(document)
    return result
  }
  const before = entities(left),
    after = entities(right)
  return {
    added: [...after.keys()].filter((id) => !before.has(id)),
    removed: [...before.keys()].filter((id) => !after.has(id)),
    modified: [...after.keys()].filter((id) => before.has(id) && before.get(id) !== after.get(id)),
  }
}
