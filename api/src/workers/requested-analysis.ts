import type { Database } from '../db/connection'
import type { Config } from '../config/env'
import type { ObjectStore } from '../storage/objects'
import type { PlanIntelligenceProvider } from '../modules/ai/provider'
import type { Metrics } from '../middleware/observability'
import { Worker } from './runner'
import { log } from '../security/log'
import {recoverExhausted} from '../jobs/queue'

// Development runs only IDs explicitly requested/resumed through authenticated routes.
// Starting the API never drains historical jobs or sends other drawings to a provider.
export class RequestedAnalysis {
  private pending = new Set<string>()
  private active = new Map<string,Worker>()
  private stopping = false
  constructor(private db:Database,private config:Config,private store?:ObjectStore,
    private provider?:PlanIntelligenceProvider,private metrics?:Metrics) {}
  start(id:string) {
    if (this.stopping || this.active.has(id)) return
    this.pending.add(id);this.pump()
  }
  private pump() {
    while (!this.stopping && this.active.size<2 && this.pending.size) {
      const id=this.pending.values().next().value!
      this.pending.delete(id)
      const worker=new Worker(this.db,this.config,this.store,this.provider,this.metrics)
      this.active.set(id,worker)
      void this.process(id,worker).catch(()=>log('analysis.execution_unavailable',{jobId:id}))
        .finally(()=>{this.active.delete(id);this.pump()})
    }
  }
  private async process(id:string,worker:Worker) {
    while (!this.stopping) {
      const [job]=await this.db`SELECT status,kind,available_at,attempts,max_attempts,lease_expires_at FROM jobs WHERE id=${id}`
      if (!job || job.kind!=='plan.analyze' || !['queued','running'].includes(job.status)) return
      if (job.status==='running' && new Date(job.lease_expires_at).getTime()>Date.now()) return // Another process owns its lease.
      if (job.attempts>=job.max_attempts) {await recoverExhausted(this.db,id);return}
      const delay=Math.max(0,new Date(job.available_at).getTime()-Date.now())
      if (delay) await new Promise(resolve=>setTimeout(resolve,Math.min(delay,1000)))
      else if (!await worker.runOnce(id)) return
    }
  }
  stop() {this.stopping=true;this.pending.clear();for(const worker of this.active.values())worker.stop()}
}
