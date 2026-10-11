import type { Database } from '../db/connection'
import { ApiError } from './errors'
import { checksum } from './tokens'
import { parse } from '../contracts/http'
import { id } from '../contracts/primitives'
export async function idempotent<T>(db: Database, actorId: string, scope: string, rawKey: string | undefined,
  input: unknown, create: (tx: Database) => Promise<T>): Promise<T> {
  if (!rawKey) throw new ApiError(400, 'IDEMPOTENCY_REQUIRED', 'Supply an Idempotency-Key header')
  const key = parse(id, rawKey), hash = checksum(input)
  return db.begin(async tx => {
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${`${actorId}:${scope}:${key}`},0))`
    const [previous] = await tx`SELECT request_hash,response FROM idempotency_keys
      WHERE actor_id=${actorId} AND scope=${scope} AND key=${key} AND expires_at>now()`
    if (previous) {
      if (previous.request_hash !== hash) throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'Key was used for different work')
      return previous.response as T
    }
    const response = await create(tx)
    await tx`INSERT INTO idempotency_keys(actor_id,scope,key,request_hash,response,expires_at)
      VALUES (${actorId},${scope},${key},${hash},${response}::jsonb,now()+interval '24 hours')
      ON CONFLICT(actor_id,scope,key) DO UPDATE SET request_hash=EXCLUDED.request_hash,response=EXCLUDED.response,expires_at=EXCLUDED.expires_at`
    return response
  })
}
