import { api } from './api'

export type JobRow<R> = { status: string; result?: R | null; failure_code?: string | null }
export type JobWaiting = { limitMs: number; failure: (code: string | null) => string; patience: string }

/** CAD jobs run a single attempt, so polling only waits for their terminal state. */
export async function waitForJob<R>(projectId: string, jobId: string, waiting: JobWaiting): Promise<R> {
  const deadline = Date.now() + waiting.limitMs
  let delay = 500
  for (;;) {
    const job = await api.request<JobRow<R>>(`/projects/${projectId}/jobs/${jobId}`)
    if (job.status === 'completed') {
      if (!job.result) throw new Error('The finished job returned no result. Run it again.')
      return job.result
    }
    if (job.status === 'failed') throw new Error(waiting.failure(job.failure_code || null))
    if (Date.now() + delay > deadline) throw new Error(waiting.patience)
    await new Promise((resolve) => setTimeout(resolve, delay))
    delay = Math.min(3000, Math.round(delay * 1.6))
  }
}
