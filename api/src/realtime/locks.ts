import type { Database } from '../db/connection'
import type { Actor } from '../modules/auth/session'
import { ApiError } from '../security/errors'
import { authorize } from '../security/permissions'
import { loadDocument } from '../modules/projects/documents'
import { emit } from '../modules/audit/service'
export async function acquireLock(db: Database,actor: Actor,projectId: string,entityId: string,connectionId: string) {
  return db.begin(async tx => {
    await tx`SELECT id FROM projects WHERE id=${projectId} FOR UPDATE`
    await authorize(tx,actor,projectId,'edit')
    const { document } = await loadDocument(tx,projectId)
    let found = false
    const walk = (value: unknown) => {
      if (!value || typeof value !== 'object') return
      if ('id' in value && value.id === entityId) found = true
      Object.values(value).forEach(walk)
    }
    walk(document)
    if (!found) throw new ApiError(404,'NOT_FOUND','Entity not found')
    const [lock] = await tx`INSERT INTO entity_locks(project_id,entity_id,user_id,connection_id,expires_at)
      VALUES (${projectId},${entityId},${actor.id},${connectionId},now()+interval '30 seconds')
      ON CONFLICT(project_id,entity_id) DO UPDATE SET user_id=EXCLUDED.user_id,connection_id=EXCLUDED.connection_id,expires_at=EXCLUDED.expires_at
      WHERE entity_locks.expires_at<=now() OR entity_locks.connection_id=${connectionId} RETURNING entity_id,expires_at`
    if (!lock) throw new ApiError(409,'ENTITY_LOCKED','Another collaborator holds this lock')
    await emit(tx,projectId,'lock.acquired',{ entityId,userId:actor.id,expiresAt:lock.expires_at })
    return lock
  })
}
export async function releaseLock(db: Database,projectId: string,entityId: string,connectionId: string) {
  await db.begin(async tx => {
    const rows = await tx`DELETE FROM entity_locks WHERE project_id=${projectId} AND entity_id=${entityId} AND connection_id=${connectionId} RETURNING entity_id`
    if (rows.length) await emit(tx,projectId,'lock.released',{ entityId })
  })
}
