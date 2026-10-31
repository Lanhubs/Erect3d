import type { Database } from '../db/connection'

// A source link is only kept when some saved document revision still names it, so an import
// abandoned for a day before its first save cannot pin private assets.
export async function maintenance(db: Database) {
  await db`DELETE FROM sessions WHERE expires_at<now()-interval '7 days' OR revoked_at<now()-interval '7 days'`
  await db`DELETE FROM rate_windows WHERE expires_at<now()-interval '1 day'`
  await db`DELETE FROM idempotency_keys WHERE expires_at<now()`
  await db`DELETE FROM login_failures WHERE updated_at<now()-interval '1 day'`
  await db`DELETE FROM realtime_events WHERE created_at<now()-interval '7 days'`
  await db`DELETE FROM source_plans sp
    WHERE sp.created_at < now() - interval '24 hours'
      AND NOT EXISTS (
        SELECT 1 FROM snapshots s
        WHERE s.project_id = sp.project_id
          AND s.document -> 'sources' @> jsonb_build_array(jsonb_build_object('id', sp.source_id))
      )`
}
