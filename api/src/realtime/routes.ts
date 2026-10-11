import { Hono } from 'hono'
import { upgradeWebSocket } from '@hono/bun'
import { getCookie } from 'hono/cookie'
import { z } from 'zod'
import type { ApiEnv } from '../middleware/types'
import type { Hub,Connection } from './hub'
import type { RateLimiter } from '../security/rate-limit'
import { ApiError } from '../security/errors'
import { authorize } from '../security/permissions'
import { parse,param } from '../contracts/http'
import { messageSchema,maximumMessageBytes } from './protocol'
import { commitOperation } from '../modules/projects/operations'
import { extendSession } from '../modules/auth/session'
import { acquireLock,releaseLock } from './locks'
import { readOperations } from '../modules/projects/history'
import { sendFrame } from './send'
export function realtimeRoutes(hub: Hub,limits: RateLimiter) {
  const routes = new Hono<ApiEnv>()
  routes.get('/projects/:projectId',async (context,next) => {
    const projectId = param(context,'projectId'),actor = context.get('actor')
    const query = parse(z.object({ afterRevision:z.coerce.number().int().nonnegative().default(0) }).strict(),context.req.query())
    const origin = context.req.header('Origin')
    if (!origin || !hub.config.ALLOWED_ORIGINS.split(',').map(value=>value.trim()).includes(origin)) throw new ApiError(403,'ORIGIN_DENIED','Untrusted WebSocket origin')
    if (context.req.header('Upgrade')?.toLowerCase()!=='websocket') throw new ApiError(400,'UPGRADE_REQUIRED','Use a WebSocket connection')
    await authorize(hub.db,actor,projectId)
    await limits.consume(`ws-connect:${actor.id}`,20,60)
    const id = crypto.randomUUID(),sessionToken = getCookie(context,hub.config.COOKIE_NAME)!
    await hub.reserve(actor,projectId,id)
    let connection: Connection
    return upgradeWebSocket(() => ({
      onOpen: (_event,ws) => {
        connection = { id,projectId,actor,sessionToken,ws,lastSeen:Date.now(),seen:new Set(),pending:Promise.resolve(),queued:0 }
        hub.add(connection)
        sendFrame(ws,{ type:'connected',connectionId:id,userId:actor.id })
        connection.pending = resume(hub,connection,query.afterRevision).catch(()=>ws.close(1011,'Unable to resume'))
      },
      onMessage: (event,ws) => {
        if (typeof event.data!=='string' || new TextEncoder().encode(event.data).byteLength>maximumMessageBytes || connection.queued>=10) {
          ws.close(1009,'Message limit exceeded'); return
        }
        const raw = event.data
        connection.queued++
        connection.pending = connection.pending.then(async () => {
          try {
            const input = parse(messageSchema,JSON.parse(raw))
            connection.lastSeen = Date.now()
            const current = await hub.authorized(connection)
            await extendSession(hub.db,current,hub.config)
            await limits.consume(`ws-message:${current.id}`,300,60)
            if (input.type==='pong') return
            if (input.type==='resume') { await resume(hub,connection,input.afterRevision); return }
            if (input.type==='operation.apply') {
              const accepted = await commitOperation(hub.db,hub.config,current,projectId,input.operation)
              sendFrame(ws,{ type:'operation.ack',operationId:accepted.operationId,revision:accepted.revision })
            } else if (input.type==='presence.update') {
              await limits.consume(`presence:${current.id}`,120,60)
              await hub.db`INSERT INTO presence_events(project_id,user_id,connection_id,payload,expires_at)
                VALUES (${projectId},${current.id},${id},${input.presence}::jsonb,now()+interval '30 seconds')`
            } else if (input.type==='lock.acquire') await acquireLock(hub.db,current,projectId,input.entityId,id)
            else if (input.type==='lock.release') await releaseLock(hub.db,projectId,input.entityId,id)
          } catch (error) {
            const known = error instanceof ApiError
            sendFrame(ws,{ type:'error',error:{ code:known?error.code:'INVALID_MESSAGE',message:known?error.message:'Message rejected',requestId:crypto.randomUUID() } })
            if (known && [401,403,404,503].includes(error.status)) ws.close(1008,'Access unavailable')
          } finally { connection.queued-- }
        })
      },
      onClose: () => { void hub.remove(id).catch(()=>{}) },
      onError: () => { void hub.remove(id).catch(()=>{}) },
    }))(context,next)
  })
  return routes
}
async function resume(hub: Hub,connection: Connection,afterRevision: number) {
  const project = await authorize(hub.db,connection.actor,connection.projectId)
  if (afterRevision>Number(project.revision)) throw new ApiError(409,'REVISION_CONFLICT','Resume revision exceeds the project revision')
  const rows = await readOperations(hub.db,connection.projectId,afterRevision,200,Number(project.revision))
  const nextRevision = Number(rows.at(-1)?.revision ?? afterRevision)
  sendFrame(connection.ws,{ type:'resume',operations:rows,currentRevision:Number(project.revision),
    nextRevision,hasMore:nextRevision<Number(project.revision) })
}
