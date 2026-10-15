import type { Config } from './env'
import { connect, type Database } from '../db/connection'
import { PrivateR2, type ObjectStore } from '../storage/objects'
import { PrivateFilesystem } from '../storage/filesystem'
import { RateLimiter } from '../security/rate-limit'
import { Metrics } from '../middleware/observability'
import { Hub } from '../realtime/hub'
import { GeminiProvider } from '../modules/ai/gemini'
import type { PlanIntelligenceProvider } from '../modules/ai/provider'
import { Readiness } from '../middleware/readiness'
import type { TelemetrySink } from '../middleware/telemetry'
import { configureLogging } from '../security/log'
import { RequestedAnalysis } from '../workers/requested-analysis'
export type Services = ReturnType<typeof createServices>
export function createServices(config: Config, overrides: { db?: Database; store?: ObjectStore; provider?: PlanIntelligenceProvider; telemetry?: TelemetrySink } = {}) {
  configureLogging(config.LOG_LEVEL)
  const db = overrides.db || connect(config)
  const store = overrides.store || (config.STORAGE_BACKEND === 'filesystem'
    ? new PrivateFilesystem(config.STORAGE_ROOT!, config.STORAGE_SIGNING_KEY!) : config.R2_BUCKET ? new PrivateR2(config) : undefined)
  const provider = overrides.provider || (config.GEMINI_API_KEY ? new GeminiProvider(config.GEMINI_API_KEY) : undefined)
  const metrics = new Metrics(overrides.telemetry), limits = new RateLimiter(db, config), hub = new Hub(db, config, metrics)
  const readiness = new Readiness(db, config, limits, store)
  const requestedAnalysis=config.NODE_ENV==='development'?new RequestedAnalysis(db,config,store,provider,metrics):undefined
  return { config, db, store, provider, metrics, limits, hub, readiness,requestedAnalysis }
}
