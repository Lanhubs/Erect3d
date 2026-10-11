import type { Database } from '../db/connection'
import { ApiError } from './errors'
import { digest } from './tokens'
export async function checkLogin(db:Database,email:string) {
  const [row]=await db`SELECT blocked_until FROM login_failures WHERE key=${digest(email)}`
  if (row?.blocked_until && new Date(row.blocked_until).getTime()>Date.now()) throw new ApiError(429,'LOGIN_THROTTLED','Sign-in is temporarily limited. Try again later')
}
export async function failedLogin(db:Database,email:string) {
  await db`INSERT INTO login_failures(key,failures,blocked_until,updated_at) VALUES (${digest(email)},1,NULL,now())
    ON CONFLICT(key) DO UPDATE SET failures=CASE WHEN login_failures.updated_at<now()-interval '1 hour' THEN 1 ELSE login_failures.failures+1 END,
    blocked_until=CASE WHEN login_failures.failures>=3 THEN now()+LEAST(900,power(2,LEAST(login_failures.failures,10))) * interval '1 second' ELSE NULL END,
    updated_at=now()`
}
export async function successfulLogin(db:Database,email:string) { await db`DELETE FROM login_failures WHERE key=${digest(email)}` }
