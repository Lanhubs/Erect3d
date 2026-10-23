import type { Database } from '../db/connection'
import type { Job } from './queue'
import { ApiError } from '../security/errors'
export async function assertLease(db: Database, job: Job) {
  const [row] = await db`SELECT id FROM jobs WHERE id=${job.id} AND status='running'
    AND lease_owner=${job.lease_owner} AND lease_expires_at>now() FOR UPDATE`
  if (!row)
    throw new ApiError(409, 'LEASE_LOST', 'Background work was cancelled or claimed by another worker')
}
