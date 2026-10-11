import { websocket } from '@hono/bun'
import { createApp } from './app'
import { readConfig } from './config/env'
import { createServices } from './config/services'
import { maximumMessageBytes } from './realtime/protocol'
import { log } from './security/log'
const config = readConfig(),services = createServices(config),app = createApp(services)
await services.readiness.check()
await services.hub.start()
const server = Bun.serve({ hostname:config.HOST,port:config.PORT,
  fetch:(request,server)=>app.fetch(request,{ server }),
  websocket:{ ...websocket,maxPayloadLength:maximumMessageBytes,idleTimeout:60,sendPings:true,
    backpressureLimit:4*1024*1024,closeOnBackpressureLimit:true },
  maxRequestBodySize:2*1024*1024,
})
log('api.started',{ port:server.port,environment:config.NODE_ENV })
let stopping = false
async function shutdown() {
  if (stopping) return
  stopping = true
  server.stop(false)
  await services.hub.stop()
  services.limits.close()
  await services.db.close({ timeout:5 })
  log('api.stopped')
  process.exit(0)
}
process.on('SIGINT',()=>void shutdown())
process.on('SIGTERM',()=>void shutdown())
