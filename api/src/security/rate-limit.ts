import { RedisClient } from 'bun'
import type { Config } from '../config/env'
import type { Database } from '../db/connection'
import { ApiError } from './errors'
export class RateLimiter {
  redis?: RedisClient
  private connecting?:Promise<void>
  constructor(private db: Database, private config: Config) {
    if (config.REDIS_URL) this.redis = new RedisClient(config.REDIS_URL, { enableOfflineQueue: false, connectionTimeout: 2000,maxRetries:3 })
  }
  async ready() {
    if (!this.redis || this.redis.connected) return
    this.connecting ||= this.redis.connect().finally(()=>{ this.connecting=undefined })
    await this.connecting
  }
  async consume(key: string, maximum: number, seconds: number): Promise<void> {
    let count: number
    try {
      if (this.config.RATE_LIMIT_BACKEND === 'redis') {
        await this.ready()
        const script = "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n"
        count = Number(await this.redis!.send('EVAL', [script, '1', `erect:${key}`, String(seconds)]))
      } else {
        const [row] = await this.db`INSERT INTO rate_windows(key,count,expires_at)
          VALUES (${key},1,now()+${seconds}*interval '1 second') ON CONFLICT(key) DO UPDATE
          SET count=CASE WHEN rate_windows.expires_at<now() THEN 1 ELSE rate_windows.count+1 END,
          expires_at=CASE WHEN rate_windows.expires_at<now() THEN EXCLUDED.expires_at ELSE rate_windows.expires_at END RETURNING count`
        count = row.count
      }
    } catch { throw new ApiError(503, 'RATE_LIMIT_UNAVAILABLE', 'Request protection is temporarily unavailable') }
    if (count > maximum) throw new ApiError(429, 'RATE_LIMITED', 'Too many requests. Try again later')
  }
  close() { this.redis?.close() }
}
