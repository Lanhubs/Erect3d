import { afterAll, expect, test } from 'bun:test'
import { RedisClient } from 'bun'
import { RateLimiter } from '../src/security/rate-limit'
import { harness } from './helpers'
import { readConfig } from '../src/config/env'
const h = harness(),
  url = process.env.TEST_REDIS_URL
const native = url ? new RedisClient(url, { enableOfflineQueue: false, connectionTimeout: 2000 }) : undefined
afterAll(async () => {
  native?.close()
  h.limits.close()
  await h.db.close()
})
test.skipIf(!url)(
  'native Redis atomic limits are shared by separate clients and TTL is applied',
  async () => {
    const config = readConfig({
      DATABASE_URL: h.config.DATABASE_URL,
      REDIS_URL: url,
      RATE_LIMIT_BACKEND: 'redis',
      NODE_ENV: 'test',
    })
    const a = new RateLimiter(h.db, config),
      b = new RateLimiter(h.db, config),
      key = `test:${crypto.randomUUID()}`
    try {
      await native!.connect()
      await a.consume(key, 2, 30)
      await b.consume(key, 2, 30)
      await expect(a.consume(key, 2, 30)).rejects.toThrow('Too many requests')
      expect(Number(await native!.send('TTL', [`erect:${key}`]))).toBeGreaterThan(0)
    } finally {
      if (native!.connected) await native!.del(`erect:${key}`)
      a.close()
      b.close()
    }
  },
)
