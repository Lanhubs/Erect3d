import { Hono } from 'hono'
import { z } from 'zod'
import type { ApiEnv } from '../../middleware/types'
import type { Database } from '../../db/connection'
import { body } from '../../contracts/http'
import { name } from '../../contracts/primitives'
import { ApiError } from '../../security/errors'
import { audit } from '../audit/service'
export function userRoutes(db:Database) {
  const routes = new Hono<ApiEnv>()
  routes.get('/me',context => {
    const { id,name,email } = context.get('actor')
    return context.json({ id,name,email })
  })
  routes.patch('/me',async context => {
    const input = await body(context,z.object({ name }).strict()),actor = context.get('actor')
    await db`UPDATE users SET name=${input.name} WHERE id=${actor.id}`
    return context.json({ id:actor.id,name:input.name,email:actor.email })
  })
  routes.post('/me/password',async context => {
    const input = await body(context,z.object({ currentPassword:z.string().max(256),newPassword:z.string().min(12).max(256) }).strict())
    const actor = context.get('actor'),hash = await Bun.password.hash(input.newPassword,{ algorithm:'argon2id' })
    await db.begin(async tx => {
      const [user] = await tx`SELECT password_hash FROM users WHERE id=${actor.id} FOR UPDATE`
      if (!await Bun.password.verify(input.currentPassword,user.password_hash)) throw new ApiError(401,'PASSWORD_FAILED','Current password is incorrect')
      await tx`UPDATE users SET password_hash=${hash} WHERE id=${actor.id}`
      await tx`UPDATE sessions SET revoked_at=now() WHERE user_id=${actor.id}`
      await audit(tx,actor,null,'auth.password_changed',context.get('requestId'))
    })
    return context.json({ signInRequired:true })
  })
  return routes
}
