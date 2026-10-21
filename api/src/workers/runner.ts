import type { Database } from '../db/connection'
import type { Config } from '../config/env'
import type { ObjectStore } from '../storage/objects'
import type { PlanIntelligenceProvider } from '../modules/ai/provider'
import { classifyFailure } from '../modules/ai/provider'
import { ApiError } from '../security/errors'
import { log } from '../security/log'
import { claim,complete,fail,recoverExhausted,renew } from '../jobs/queue'
import { analyze } from './analyze'
import { normalizeImage,purgeAsset } from './images'
import { exportProject,snapshotProject } from './exports'
import { maintenance } from './maintenance'
import type { Metrics } from '../middleware/observability'
import { report } from '../middleware/telemetry'
import type {EditingProvider} from '../modules/assistant/provider'
import {runAssistant} from '../modules/assistant/run'
export class Worker {
  private stopping = false
  private controller?: AbortController
  private lastMaintenance=0
  readonly id = crypto.randomUUID()
  constructor(private db: Database,private config: Config,private store?: ObjectStore,private provider?: PlanIntelligenceProvider,private metrics?: Metrics,private editingProvider?:EditingProvider) {}
  async runOnce(requestedId?: string) {
    if (this.stopping) return false
    if (!requestedId && Date.now()-this.lastMaintenance>3600000) { await maintenance(this.db);this.lastMaintenance=Date.now() }
    await recoverExhausted(this.db,requestedId)
    const job = await claim(this.db,this.id,this.config.WORKER_LEASE_SECONDS,requestedId)
    if (!job) return false
    const controller = new AbortController()
    const started=performance.now()
    this.controller = controller
    const interval = setInterval(() => {
      renew(this.db,job,this.config.WORKER_LEASE_SECONDS).then(valid => { if (!valid) controller.abort() }).catch(() => controller.abort())
    },Math.min(5000,this.config.WORKER_LEASE_SECONDS*1000/3))
    try {
      let result: unknown
      switch (job.kind) {
        case 'assistant.edit': result=await runAssistant(this.db,this.config,this.editingProvider,this.store,job,controller.signal);break
        case 'plan.analyze': result = await analyze(this.db,this.config,this.store,this.provider,job,controller.signal); break
        case 'asset.normalize': result = await normalizeImage(this.db,this.store,job); break
        case 'asset.purge': result = await purgeAsset(this.db,this.store,job); break
        case 'export': result = await exportProject(this.db,this.store,job); break
        case 'project.snapshot': result = await snapshotProject(this.db,job); break
        default: throw new ApiError(422,'UNKNOWN_JOB','Unsupported background job')
      }
      if (await complete(this.db,job,result)) {
        if (this.metrics) this.metrics.jobsCompleted++
        report(this.metrics?.sink,'job',{ kind:job.kind,status:'completed',elapsedMs:performance.now()-started })
        log('job.completed',{ jobId:job.id,requestId:job.request_id,kind:job.kind })
      }
    } catch (error) {
      const failure = error instanceof ApiError ? { code:error.code,retryable:error.status===503 } : classifyFailure(error)
      await fail(this.db,job,failure.code,failure.retryable)
      if (this.metrics) this.metrics.jobsFailed++
      report(this.metrics?.sink,'job',{ kind:job.kind,status:'failed',elapsedMs:performance.now()-started })
      log('job.failed',{ jobId:job.id,requestId:job.request_id,code:failure.code,retryable:failure.retryable })
      if (error instanceof TypeError) log('job.client_failed',{jobId:job.id,
        frames:(error.stack || '').split('\n').filter(line=>/^\s+at\s/.test(line)).slice(0,5).map(line=>line.replace(/https?:\/\/\S+/g,'[remote]'))})
    } finally { clearInterval(interval); this.controller = undefined }
    return true
  }
  async run(signal: AbortSignal) {
    while (!signal.aborted && !this.stopping) {
      try { if (await this.runOnce()) continue } catch { log('worker.dependencies_unavailable') }
      await new Promise<void>(resolve => {
        const timeout = setTimeout(done,this.config.WORKER_POLL_MS)
        function done() { clearTimeout(timeout); signal.removeEventListener('abort',done); resolve() }
        signal.addEventListener('abort',done,{ once:true })
      })
    }
  }
  stop() { this.stopping = true; this.controller?.abort() }
}
