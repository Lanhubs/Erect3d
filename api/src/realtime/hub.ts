import type { WSContext } from 'hono/ws'
import type { SQL } from 'bun'
import type { Database } from '../db/connection'
import type { Config } from '../config/env'
import type { Actor } from '../modules/auth/session'
import { authenticate } from '../modules/auth/session'
import { authorize } from '../security/permissions'
import { ApiError } from '../security/errors'
import { log } from '../security/log'
import type { Metrics } from '../middleware/observability'
import { report } from '../middleware/telemetry'
import { sendFrame } from './send'
export type Connection = { id:string;projectId:string;actor:Actor;sessionToken:string;ws:WSContext;
  lastSeen:number;seen:Set<string>;pending:Promise<void>;queued:number }
export class Hub {
  readonly instanceId = crypto.randomUUID()
  readonly connections = new Map<string,Connection>()
  private subscriptions: SQL.ListenSubscription[] = []
  private timer?: ReturnType<typeof setInterval>
  constructor(readonly db: Database,readonly config: Config,readonly metrics: Metrics) {}
  async start() {
    this.subscriptions.push(await this.db.listen('erect_events',id => {
      void this.deliver(id,false).catch(() => log('realtime.delivery_failed'))
    },() => { void this.catchUp().catch(() => log('realtime.catchup_failed')) }))
    this.subscriptions.push(await this.db.listen('erect_presence',id => {
      void this.deliver(id,true).catch(() => log('presence.delivery_failed'))
    }))
    this.timer = setInterval(() => { void this.tick().catch(() => log('realtime.heartbeat_failed')) },15000)
  }
  async reserve(actor: Actor,projectId: string,id: string) {
    await this.db.begin(async tx => {
      await tx`SELECT pg_advisory_xact_lock(hashtextextended(${`ws:${actor.id}`},0))`
      const [count] = await tx`SELECT count(*)::int AS count FROM websocket_connections WHERE user_id=${actor.id} AND expires_at>now()`
      if (count.count>=8) throw new ApiError(429,'CONNECTION_LIMIT','Too many active collaboration connections')
      await tx`INSERT INTO websocket_connections(id,user_id,project_id,instance_id,expires_at)
        VALUES (${id},${actor.id},${projectId},${this.instanceId},now()+interval '60 seconds')`
    })
  }
  add(connection: Connection) {
    this.connections.set(connection.id,connection); this.metrics.connections++
    report(this.metrics.sink,'connection',{ active:this.metrics.connections })
  }
  async remove(id: string) {
    if (this.connections.delete(id)) {
      this.metrics.connections--
      report(this.metrics.sink,'connection',{ active:this.metrics.connections })
    }
    await this.db`DELETE FROM websocket_connections WHERE id=${id}`
    await this.db`DELETE FROM entity_locks WHERE connection_id=${id}`
  }
  async authorized(connection: Connection) {
    const actor = await authenticate(this.db,connection.sessionToken)
    await authorize(this.db,actor,connection.projectId)
    return actor
  }
  async deliver(id: string,transient: boolean) {
    if (!/^\d{1,20}$/.test(id)) return
    const [event] = transient
      ? await this.db`SELECT * FROM presence_events WHERE id=${id}::bigint AND expires_at>now()`
      : await this.db`SELECT * FROM realtime_events WHERE id=${id}::bigint`
    if (!event) return
    await Promise.all([...this.connections.values()].filter(connection => connection.projectId===event.project_id).map(async connection => {
      const key = `${transient?'p':'e'}:${id}`
      if (connection.seen.has(key) || transient && connection.id===event.connection_id) return
      try {
        await this.authorized(connection)
        if (connection.ws.readyState!==1) return
        if (!sendFrame(connection.ws,transient ? { type:'presence.update',userId:event.user_id,connectionId:event.connection_id,presence:event.payload }
          : { type:event.type,eventId:id,payload:event.payload })) return
        connection.seen.add(key)
        if (connection.seen.size>2000) connection.seen.delete(connection.seen.values().next().value!)
      } catch { connection.ws.close(1008,'Access expired'); await this.remove(connection.id) }
    }))
  }
  async catchUp() {
    if (!this.connections.size) return
    const projects = [...new Set([...this.connections.values()].map(connection => connection.projectId))]
    const events = await this.db`SELECT id FROM realtime_events WHERE project_id=ANY(${this.db.array(projects,'TEXT')})
      AND created_at>now()-interval '2 minutes' ORDER BY id LIMIT 2000`
    for (const event of events) await this.deliver(String(event.id),false)
  }
  async tick() {
    for (const connection of this.connections.values()) {
      if (Date.now()-connection.lastSeen>45000) { connection.ws.close(1001,'Heartbeat expired'); await this.remove(connection.id); continue }
      try {
        await this.authorized(connection)
        await this.db`UPDATE websocket_connections SET expires_at=now()+interval '60 seconds' WHERE id=${connection.id}`
        sendFrame(connection.ws,{ type:'ping',time:Date.now() })
      } catch { connection.ws.close(1008,'Access expired'); await this.remove(connection.id) }
    }
    await this.catchUp()
    await this.db`DELETE FROM presence_events WHERE expires_at<now()`
    await this.db`DELETE FROM websocket_connections WHERE expires_at<now()`
    await this.db`DELETE FROM entity_locks WHERE expires_at<now()`
  }
  async stop() {
    if (this.timer) clearInterval(this.timer)
    for (const connection of [...this.connections.values()]) { connection.ws.close(1001,'Server restarting'); await this.remove(connection.id) }
    await Promise.all(this.subscriptions.map(subscription => subscription.unlisten()))
  }
}
