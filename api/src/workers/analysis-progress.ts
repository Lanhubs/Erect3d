import type { Database } from '../db/connection'
import type { Job } from '../jobs/queue'
import { emit } from '../modules/audit/service'
import { assertLease } from '../jobs/lease'
export async function analysisProgress(
  db: Database,
  job: Job,
  current: string,
  stages: string[],
  completed: string[] = [],
) {
  await db.begin(async (tx) => {
    await assertLease(tx, job)
    await emit(tx, job.project_id, 'analysis.progress', {
      analysisId: job.id,
      status: 'pending',
      progress: { current, stages, completed },
    })
  })
}
