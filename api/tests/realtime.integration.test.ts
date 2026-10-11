import { afterAll,beforeAll,expect,test } from 'bun:test'
import { websocket } from '@hono/bun'
import { account,createProject,harness,request,origin,type Account } from './helpers'
import { maximumMessageBytes } from '../src/realtime/protocol'
const first=harness(),second=harness()
let owner:Account,viewer:Account
let servers:Bun.Server<any>[]=[]
const clients:WebSocket[]=[]
beforeAll(async()=>{
  owner=await account(first.app); viewer=await account(first.app)
  await first.hub.start(); await second.hub.start()
  servers=[first,second].map(h=>Bun.serve({ hostname:'127.0.0.1',port:0,
    fetch:(req,server)=>h.app.fetch(req,{ server }),websocket:{ ...websocket,maxPayloadLength:maximumMessageBytes } }))
})
afterAll(async()=>{
  clients.forEach(client=>client.close())
  await first.hub.stop(); await second.hub.stop()
  servers.forEach(server=>server.stop(true))
  first.limits.close(); second.limits.close()
  await first.db.close(); await second.db.close()
})
function connect(server:Bun.Server<any>,user:Account,projectId:string) {
  const NativeSocket=WebSocket as unknown as { new(url:string,options:Bun.WebSocketOptions):WebSocket }
  const ws=new NativeSocket(`ws://127.0.0.1:${server.port}/api/v1/realtime/projects/${projectId}`,{ headers:{ Cookie:user.cookie,Origin:origin } })
  const messages:any[]=[]
  ws.addEventListener('message',event=>{
    const message=JSON.parse(String(event.data)); messages.push(message)
    if (message.type==='ping') ws.send(JSON.stringify({ type:'pong' }))
  })
  clients.push(ws)
  return { ws,messages }
}
async function until(predicate:()=>boolean) {
  const deadline=Date.now()+4000
  while (!predicate()) { if (Date.now()>deadline) throw new Error('Realtime event did not arrive'); await Bun.sleep(20) }
}
test('native WebSockets broadcast accepted revisions across distinct API instances',async()=>{
  const project=await createProject(first.app,owner)
  const a=connect(servers[0],owner,project.id),b=connect(servers[1],owner,project.id)
  await until(()=>a.messages.some(message=>message.type==='resume') && b.messages.some(message=>message.type==='resume'))
  a.ws.send(JSON.stringify({ type:'operation.apply',operation:{ operationId:crypto.randomUUID(),baseRevision:0,
    type:'document.patch',entityId:project.id,payload:{ changes:[{ action:'put',path:['name'],value:'Collaborative house' }] } } }))
  await until(()=>b.messages.some(message=>message.type==='operation.accepted'))
  expect(b.messages.find(message=>message.type==='operation.accepted').payload.revision).toBe(1)
  a.ws.send(JSON.stringify({ type:'presence.update',presence:{ cursor:{ x:2,z:3 },typing:true } }))
  await until(()=>b.messages.some(message=>message.type==='presence.update'))
  const [count]=await first.db`SELECT count(*)::int AS count FROM operations WHERE project_id=${project.id}`
  expect(count.count).toBe(1)
},10000)
test('unknown messages and viewer operations are rejected without changing the document',async()=>{
  const project=await createProject(first.app,owner)
  await request(first.app,owner,`/projects/${project.id}/members/${viewer.id}`,'PUT',{ role:'VIEWER' })
  const connection=connect(servers[1],viewer,project.id)
  await until(()=>connection.messages.some(message=>message.type==='connected'))
  connection.ws.send(JSON.stringify({ type:'owner.impersonate' }))
  await until(()=>connection.messages.some(message=>message.type==='error'))
  connection.ws.send(JSON.stringify({ type:'operation.apply',operation:{ operationId:crypto.randomUUID(),baseRevision:0,
    type:'document.patch',entityId:project.id,payload:{ changes:[{ action:'put',path:['name'],value:'Forbidden edit' }] } } }))
  await until(()=>connection.messages.some(message=>message.error?.code==='FORBIDDEN'))
  const [row]=await first.db`SELECT revision FROM projects WHERE id=${project.id}`
  expect(Number(row.revision)).toBe(0)
},10000)
test('WebSocket handshake refuses foreign membership and untrusted origin',async()=>{
  const project=await createProject(first.app,owner)
  const response=await first.app.request(`/api/v1/realtime/projects/${project.id}`,{ headers:{ Cookie:viewer.cookie,Origin:origin,Upgrade:'websocket' } })
  expect(response.status).toBe(404)
  const originDenied=await first.app.request(`/api/v1/realtime/projects/${project.id}`,{ headers:{ Cookie:owner.cookie,Origin:'https://evil.example',Upgrade:'websocket' } })
  expect(originDenied.status).toBe(403)
})
