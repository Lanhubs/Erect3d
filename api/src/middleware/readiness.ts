import type { Database } from '../db/connection'
import type { Config } from '../config/env'
import type { ObjectStore } from '../storage/objects'
import type { RateLimiter } from '../security/rate-limit'
export class Readiness {
  private storageCheckedAt = 0
  constructor(private db: Database, private config: Config, private limits: RateLimiter, private store?: ObjectStore) {}
  async check() {
    await this.db`SELECT 1`
    if (this.config.RATE_LIMIT_BACKEND === 'redis') { await this.limits.ready(); await this.limits.redis!.ping() }
    if (this.store && Date.now() - this.storageCheckedAt > 30000) {
      await this.store.probe()
      this.storageCheckedAt = Date.now()
    }
  }
}
