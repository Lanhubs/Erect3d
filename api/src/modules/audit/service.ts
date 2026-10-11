import type { Database } from '../../db/connection'
import type { Actor } from '../auth/session'
export async function audit(db: Database, actor: Actor | null, projectId: string | null, event: string,
  requestId: string, metadata: Record<string, unknown> = {}) {
  await db`INSERT INTO audit_events(actor_id,project_id,event,request_id,metadata)
    VALUES (${actor?.id ?? null},${projectId},${event},${requestId},${metadata}::jsonb)`
}
export async function emit(db: Database, projectId: string, type: string, payload: unknown) {
  await db`INSERT INTO realtime_events(project_id,type,payload) VALUES (${projectId},${type},${payload}::jsonb)`
}
