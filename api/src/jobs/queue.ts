import type { Database } from '../db/connection'
import type { Actor } from '../modules/auth/session'
import { newId } from '../security/tokens'
export type Job = { id: string; project_id: string; actor_id: string; kind: string;
  payload: unknown; request_id: string; attempts: number; max_attempts: number; lease_owner: string }
export async function enqueue(db: Database, actor: Actor, projectId: string, kind: string,
  payload: unknown, requestId: string, delaySeconds = 0) {
  const id = newId('job')
  await db`INSERT INTO jobs(id,project_id,actor_id,kind,payload,request_id,available_at)
    VALUES (${id},${projectId},${actor.id},${kind},${payload}::jsonb,${requestId},now()+${delaySeconds}*interval '1 second')`
  return id
}
export async function claim(db: Database, workerId: string, leaseSeconds: number): Promise<Job | undefined> {
  const [row] = await db`WITH next_job AS (
    SELECT id FROM jobs WHERE (status='queued' AND available_at<=now() OR status='running' AND lease_expires_at<now())
    AND attempts<max_attempts ORDER BY available_at,id FOR UPDATE SKIP LOCKED LIMIT 1
  ) UPDATE jobs j SET status='running',attempts=attempts+1,lease_owner=${workerId},
    lease_expires_at=now()+${leaseSeconds}*interval '1 second',started_at=COALESCE(started_at,now())
    FROM next_job WHERE j.id=next_job.id RETURNING j.*`
  return row as Job | undefined
}
export async function renew(db: Database, job: Job, seconds: number) {
  const rows = await db`UPDATE jobs SET lease_expires_at=now()+${seconds}*interval '1 second'
    WHERE id=${job.id} AND status='running' AND lease_owner=${job.lease_owner} AND lease_expires_at>now() RETURNING id`
  return rows.length > 0
}
export async function complete(db: Database, job: Job, result: unknown) {
  const rows = await db`UPDATE jobs SET status='completed',result=${result}::jsonb,completed_at=now(),lease_expires_at=NULL
    WHERE id=${job.id} AND status='running' AND lease_owner=${job.lease_owner} AND lease_expires_at>now() RETURNING id`
  return rows.length > 0
}
export async function fail(db: Database, job: Job, code: string, retry: boolean) {
  const delay = Math.min(300, 2 ** job.attempts * 3) + Math.random() * 3
  const status = retry && job.attempts < job.max_attempts ? 'queued' : 'failed'
  const changed = await db`UPDATE jobs SET status=${status},failure_code=${code},available_at=now()+${delay}*interval '1 second',
    completed_at=CASE WHEN ${status}='failed' THEN now() ELSE NULL END,lease_expires_at=NULL,lease_owner=NULL
    WHERE id=${job.id} AND status='running' AND lease_owner=${job.lease_owner} AND lease_expires_at>now() RETURNING id`
  if (changed.length && status === 'failed') await db`UPDATE analyses SET status='failed' WHERE id=${job.id} AND status='pending'`
}
export async function recoverExhausted(db: Database) {
  await db`UPDATE jobs SET status='failed',failure_code='LEASE_EXHAUSTED',completed_at=now()
    WHERE status='running' AND lease_expires_at<now() AND attempts>=max_attempts`
  await db`UPDATE analyses a SET status='failed' FROM jobs j WHERE a.id=j.id AND j.status='failed' AND a.status='pending'`
}
