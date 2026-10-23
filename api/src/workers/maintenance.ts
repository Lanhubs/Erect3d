import type { Database } from '../db/connection'
export async function maintenance(db: Database) {
  await db`DELETE FROM sessions WHERE expires_at<now()-interval '7 days' OR revoked_at<now()-interval '7 days'`
  await db`DELETE FROM rate_windows WHERE expires_at<now()-interval '1 day'`
  await db`DELETE FROM idempotency_keys WHERE expires_at<now()`
  await db`DELETE FROM login_failures WHERE updated_at<now()-interval '1 day'`
  await db`DELETE FROM realtime_events WHERE created_at<now()-interval '7 days'`
}
